/**
 * TrafficLab — engine-service (port 3003)
 *
 * Live layer for the traffic simulation engine:
 *  - spawns the patched Python engine (Website-Traffic-Generator) as a detached
 *    process group, one process per "run"
 *  - parses stdout into structured events (visits, links, bounces)
 *  - keeps per-run in-memory stats + per-minute visit buckets
 *  - streams everything to dashboards via socket.io (path "/")
 *  - REST endpoints for the Next.js server (localhost only)
 *  - on run end, POSTs the final snapshot back to the Next.js sync API
 */
import { createServer, type IncomingMessage, ServerResponse } from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, accessSync, constants } from 'node:fs'
import { resolve } from 'node:path'
import { Server } from 'socket.io'

// ---------------------------------------------------------------- config ----
const PORT      = Number(process.env.PORT ?? 3003)       // socket.io — browsers connect
const REST_PORT = Number(process.env.REST_PORT ?? 3004)  // internal REST — Next.js server calls this directly
const NEXT_APP  = process.env.NEXT_APP_URL ?? 'http://127.0.0.1:3000'

// Engine location — resolved in this order:
//   1. ENGINE_DIR env var (explicit override)
//   2. sandbox checkout path (when it exists)
//   3. repo-relative <repo>/engine (cloned TrafficLab repo layout)
const ENGINE_DIR = process.env.ENGINE_DIR
  ?? (existsSync('/home/z/my-project/Website-Traffic-Generator-With-GUI-main/venv')
      ? '/home/z/my-project/Website-Traffic-Generator-With-GUI-main'
      : resolve(__dirname, '../../engine'))
const PY          = `${ENGINE_DIR}/venv/bin/python`
const MAIN        = `${ENGINE_DIR}/main.py`
const PROXY_FILE  = `${ENGINE_DIR}/proxies.txt`
// pkill-safe escaped form of ENGINE_DIR (used for orphan cleanup)
const ENGINE_DIR_PAT = ENGINE_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const MAX_CONCURRENT_RUNS = 2
const MAX_THREADS         = 4
const MAX_RUNS_PER_DOMAIN = 1 // no duplicate-domain runs at the same time
const COMPLETED_TTL_MS    = 10 * 60_000 // keep finished snapshots for 10 min

const engineReady =
  existsSync(PY) && existsSync(MAIN) &&
  (() => { try { accessSync(PY, constants.X_OK); return true } catch { return false } })()

// ----------------------------------------------------------------- types ----
export interface RunOptions {
  runId: string
  domain: string
  threads: number
  minClicks: number
  maxClicks: number
  timeout: number
  maxOffset: number
  secure: boolean
  forever: boolean
  useProxies: boolean
}

interface RunState {
  id: string
  domain: string
  status: 'running' | 'completed' | 'stopped' | 'failed'
  options: RunOptions
  startedAt: number
  endedAt?: number
  visits: number
  bounces: number
  linksFound: number
  currentUrl?: string
  lastEventTs?: number
  recentLines: { ts: number; line: string; kind: 'visit' | 'links' | 'info' | 'error' }[]
  minutes: Map<number, number> // minuteTs -> visits
  proc?: ChildProcess
  exitReason?: string
  error?: string
}

const runs = new Map<string, RunState>()

// -------------------------------------------------------------- helpers ----
const log = (...a: unknown[]) => console.log('[engine-service]', ...a)

function minuteTs(ts = Date.now()) {
  return Math.floor(ts / 60_000) * 60_000
}

function killTree(run: RunState) {
  const proc = run.proc
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return
  const pid = proc.pid
  try {
    // spawn({ detached: true }) => child leads its own session, so -pid = pgid
    if (pid) process.kill(-pid, 'SIGTERM')
  } catch {
    try { proc.kill('SIGTERM') } catch { /* already gone */ }
    try { Bun.spawn(['bash', '-c', `kill -TERM -- -${pid} 2>/dev/null; kill -TERM ${pid} 2>/dev/null`]) } catch { /* noop */ }
  }
  // Chrome may need a moment; follow up with KILL for stragglers
  setTimeout(() => {
    try { if (pid) process.kill(-pid, 'SIGKILL') } catch { /* group gone */ }
  }, 2500)
}

function endRun(run: RunState, status: RunState['status'], reason: string, error?: string) {
  if (run.status !== 'running') return
  run.status = status
  run.endedAt = Date.now()
  run.exitReason = reason
  run.error = error
  log(`run ${run.id} (${run.domain}) ended: ${status}/${reason}`)

  // tell dashboards
  io.emit('run-ended', {
    runId: run.id,
    reason,
    status,
    finalStats: snapshotRun(run, false),
  })

  // persist via the Next.js app (retry a couple of times; the live route can
  // also finalize later from the in-memory snapshot)
  const push = (attempt = 0) => {
    fetch(`${NEXT_APP}/api/engine/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: run.id,
        status,
        reason,
        visits: run.visits,
        bounces: run.bounces,
        linksFound: run.linksFound,
        endedAt: new Date(run.endedAt).toISOString(),
        error: error ?? null,
      }),
    }).then(r => { if (!r.ok && attempt < 2) push(attempt + 1) })
      .catch(() => { if (attempt < 2) setTimeout(() => push(attempt + 1), 2000) })
  }
  push()

  // GC finished runs after TTL
  setTimeout(() => { if (runs.get(run.id)?.status !== 'running') runs.delete(run.id) }, COMPLETED_TTL_MS)
}

function snapshotRun(run: RunState, includeMinutes: boolean) {
  return {
    id: run.id,
    domain: run.domain,
    status: run.status,
    threads: run.options.threads,
    secure: run.options.secure,
    forever: run.options.forever,
    startedAt: new Date(run.startedAt).toISOString(),
    endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
    visits: run.visits,
    bounces: run.bounces,
    linksFound: run.linksFound,
    currentUrl: run.currentUrl ?? null,
    lastEventTs: run.lastEventTs ? new Date(run.lastEventTs).toISOString() : null,
    error: run.error ?? null,
    minutes: includeMinutes
      ? Array.from(run.minutes.entries())
          .sort((a, b) => a[0] - b[0])
          .slice(-30)
          .map(([ts, visits]) => ({ ts, visits }))
      : undefined,
  }
}

// ------------------------------------------------------- python spawning ----
function startRun(opts: RunOptions): { ok: true } | { ok: false; error: string } {
  if (!engineReady)
    return { ok: false, error: `Python engine not found at ${ENGINE_DIR} (expected venv + main.py). Run the repo setup script (./setup.sh) or set ENGINE_DIR.` }

  const active = [...runs.values()].filter(r => r.status === 'running')
  if (active.length >= MAX_CONCURRENT_RUNS)
    return { ok: false, error: `Engine busy: at most ${MAX_CONCURRENT_RUNS} concurrent run${MAX_CONCURRENT_RUNS > 1 ? 's' : ''} are allowed.` }
  if (active.some(r => r.domain === opts.domain))
    return { ok: false, error: `A run for ${opts.domain} is already active.` }

  const args = [
    '-u', MAIN,
    '-d', opts.domain,
    '-t', String(opts.threads),
    '-to', String(opts.timeout),
    '-mo', String(opts.maxOffset),
    '-mac', String(opts.maxClicks),
    '-mic', String(opts.minClicks),
  ]
  if (opts.secure) args.push('-s')
  if (opts.forever) args.push('--forever')
  if (opts.useProxies) args.push('--proxy-file', PROXY_FILE)

  const run: RunState = {
    id: opts.runId,
    domain: opts.domain,
    status: 'running',
    options: { ...opts, threads: Math.min(opts.threads, MAX_THREADS) },
    startedAt: Date.now(),
    visits: 0,
    bounces: 0,
    linksFound: 0,
    recentLines: [],
    minutes: new Map(),
  }
  runs.set(run.id, run)

  let proc: ChildProcess
  try {
    proc = spawn(PY, args, {
      cwd: ENGINE_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      detached: true, // own session/pgid so we can kill driver+chrome cleanly
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    runs.delete(run.id)
    return { ok: false, error: `Failed to spawn engine: ${(e as Error).message}` }
  }
  run.proc = proc

  const emitLine = (line: string, kind: 'visit' | 'links' | 'info' | 'error', source: 'out' | 'err') => {
    run.recentLines.push({ ts: Date.now(), line, kind })
    if (run.recentLines.length > 400) run.recentLines.splice(0, run.recentLines.length - 400)
    run.lastEventTs = Date.now()
    io.emit('log', { runId: run.id, ts: Date.now(), line, kind, source })
  }

  // --- stdout parser ------------------------------------------------------
  createInterface({ input: proc.stdout! }).on('line', (raw: string) => {
    const line = raw.trimEnd()
    if (!line) return

    // [HH:MM:SS][ip] Found N links
    let m = line.match(/\[(\d{2}:\d{2}:\d{2})\]\[([^\]]*)\] Found (\d+) links/)
    if (m) {
      const n = parseInt(m[3], 10)
      run.linksFound += n
      emitLine(line, 'links', 'out')
      return
    }

    // [HH:MM:SS][ip] Visiting now: <url-or-"previous page">
    m = line.match(/\[(\d{2}:\d{2}:\d{2})\]\[([^\]]*)\] Visiting now: (.+)$/)
    if (m) {
      const target = m[3].trim()
      if (target === 'previous page') {
        run.bounces += 1
        emitLine(line, 'info', 'out')
      } else {
        run.visits += 1
        run.currentUrl = target
        const k = minuteTs()
        run.minutes.set(k, (run.minutes.get(k) ?? 0) + 1)
        emitLine(line, 'visit', 'out')
      }
      return
    }

    emitLine(line, line.toLowerCase().includes('error') ? 'error' : 'info', 'out')
  })

  // chromedriver + selenium warnings land on stderr
  const errTail: string[] = []
  createInterface({ input: proc.stderr! }).on('line', (raw: string) => {
    const line = raw.trimEnd()
    if (!line) return
    errTail.push(line)
    if (errTail.length > 6) errTail.shift()
    if (/error|exception|traceback/i.test(line)) emitLine(line, 'error', 'err')
  })

  proc.on('error', e => endRun(run, 'failed', 'spawn-error', (e as Error).message))
  proc.on('exit', (code, signal) => {
    if (run.status !== 'running') return
    if (signal) endRun(run, 'stopped', `signal:${signal}`)
    else if (code === 0) endRun(run, 'completed', 'exit:0')
    else endRun(run, 'failed', `exit:${code}`, errTail.join(' | ') || undefined)
  })

  log(`run ${run.id} started: ${opts.domain} threads=${opts.threads} forever=${opts.forever}`)
  io.emit('run-started', { runId: run.id, domain: run.domain })
  return { ok: true }
}

function stopRun(runId: string | 'all'): { ok: boolean; stopped: string[]; error?: string } {
  const targets = [...runs.values()].filter(
    r => r.status === 'running' && (runId === 'all' || r.id === runId),
  )
  if (targets.length === 0)
    return { ok: false, stopped: [], error: 'No active run matches.' }
  for (const r of targets) {
    r.exitReason = 'stopped-by-user'
    killTree(r)
    endRun(r, 'stopped', 'stopped-by-user')
  }
  return { ok: true, stopped: targets.map(r => r.id) }
}

// ------------------------------------------------------------ REST layer ----
async function readJson<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') as T } catch { return {} as T }
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(payload)
}

const httpServer = createServer((_req, res) => {
  // socket.io owns this server (path '/'); anything that slips through is 404
  res.writeHead(404).end()
})

const restServer = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${REST_PORT}`)
  if (url.pathname === '/status' && req.method === 'GET') {
    const active = [...runs.values()].filter(r => r.status === 'running')
    return send(res, 200, {
      ok: true,
      engineReady,
      activeRunIds: active.map(r => r.id),
      active: active.map(r => snapshotRun(r, true)),
      recent: [...runs.values()]
        .filter(r => r.status !== 'running')
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
        .slice(0, 10)
        .map(r => snapshotRun(r, false)),
    })
  }
  if (url.pathname === '/start' && req.method === 'POST') {
    readJson<RunOptions>(req).then(opts => {
      const errors: string[] = []
      if (!opts?.runId || !opts?.domain) errors.push('runId and domain are required')
      if (opts.threads != null && (opts.threads < 1 || opts.threads > MAX_THREADS))
        errors.push(`threads must be 1..${MAX_THREADS}`)
      if (opts.minClicks != null && opts.maxClicks != null && opts.minClicks > opts.maxClicks)
        errors.push('minClicks must be <= maxClicks')
      if (errors.length) return send(res, 400, { ok: false, error: errors.join('; ') })
      const result = startRun({
        runId: String(opts.runId),
        domain: String(opts.domain),
        threads: Math.max(1, Math.min(Number(opts.threads) || 2, MAX_THREADS)),
        minClicks: Math.max(0, Number(opts.minClicks) || 1),
        maxClicks: Math.max(1, Number(opts.maxClicks) || 4),
        timeout: Math.min(Math.max(Number(opts.timeout) || 20, 10), 120),
        maxOffset: Math.min(Math.max(Number(opts.maxOffset) || 8, 1), 30),
        secure: opts.secure !== false,
        forever: opts.forever === true,
        useProxies: opts.useProxies === true,
      })
      send(res, result.ok ? 200 : 409, result)
    })
    return
  }
  if (url.pathname === '/stop' && req.method === 'POST') {
    readJson<{ runId?: string }>(req).then(({ runId }) => {
      const target = !runId || runId === 'all' ? 'all' : String(runId)
      const result = stopRun(target)
      send(res, result.ok ? 200 : 404, result)
    })
    return
  }
  send(res, 404, { ok: false, error: 'not found' })
})

// -------------------------------------------------------------- socket.io ---
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
})

io.on('connection', socket => {
  log('dashboard connected:', socket.id)

  // push current state immediately, then every second
  const tick = () => {
    const active = [...runs.values()].filter(r => r.status === 'running')
    socket.emit('stats', {
      ts: Date.now(),
      engineReady,
      activeRuns: active.map(r => snapshotRun(r, true)),
      recentEnded: [...runs.values()]
        .filter(r => r.status !== 'running')
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
        .slice(0, 5)
        .map(r => ({ runId: r.id, domain: r.domain, status: r.status, visits: r.visits })),
    })
  }
  tick()
  const timer = setInterval(tick, 1000)
  socket.on('get-backlog', (runId: string) => {
    const run = runs.get(runId)
    if (run) socket.emit('backlog', { runId, lines: run.recentLines.slice(-200) })
  })
  socket.on('disconnect', () => { clearInterval(timer) })
})

// boot: clean up any orphaned engine processes from a previous service life
if (engineReady) {
  try {
    Bun.spawn(['bash', '-c',
      `pkill -TERM -u "$(id -un)" -f '${ENGINE_DIR_PAT}.*main\\.py' 2>/dev/null || true`])
  } catch { /* noop */ }
}

httpServer.listen(PORT, () => {
  log(`socket.io listening on :${PORT} (engineReady=${engineReady})`)
  restServer.listen(REST_PORT, () => log(`REST listening on :${REST_PORT}`))
})

process.on('SIGTERM', () => {
  for (const r of [...runs.values()]) if (r.status === 'running') { killTree(r); r.status = 'stopped'; r.endedAt = Date.now() }
  httpServer.close(() => restServer.close(() => process.exit(0)))
})
process.on('SIGINT', () => {
  for (const r of [...runs.values()]) if (r.status === 'running') { killTree(r); r.status = 'stopped'; r.endedAt = Date.now() }
  httpServer.close(() => restServer.close(() => process.exit(0)))
})
