import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { engine } from '@/lib/engine-client'
import { checkDomain } from '@/lib/domain-guard'

export const runtime = 'nodejs'

interface StartBody {
  domain?: string
  threads?: number
  minClicks?: number
  maxClicks?: number
  timeout?: number
  maxOffset?: number
  secure?: boolean
  forever?: boolean
  useProxies?: boolean
}

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(Math.max(Math.round(v), min), max)
}

export async function POST(req: Request) {
  let body: StartBody
  try {
    body = (await req.json()) as StartBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const domainCheck = checkDomain(body.domain ?? '')
  if (!domainCheck.ok) {
    return NextResponse.json({ ok: false, error: domainCheck.error }, { status: 400 })
  }
  const domain = domainCheck.domain!

  const opts = {
    threads: clamp(body.threads, 1, 4, 2),
    minClicks: clamp(body.minClicks, 1, 5, 1),
    maxClicks: clamp(body.maxClicks, 2, 10, 4),
    timeout: clamp(body.timeout, 10, 90, 20),
    maxOffset: clamp(body.maxOffset, 1, 20, 8),
    secure: body.secure !== false,
    forever: body.forever === true,
    useProxies: body.useProxies === true,
  }
  if (opts.minClicks > opts.maxClicks) opts.minClicks = opts.maxClicks

  // ask the engine to spawn
  const runId = randomUUID()
  let spawn
  try {
    spawn = await engine.start({ runId, domain, ...opts })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Engine service unreachable. Is mini-services/engine-service running?' },
      { status: 502 },
    )
  }
  if (!spawn.ok) {
    return NextResponse.json({ ok: false, error: spawn.error ?? 'Engine refused to start.' }, { status: 409 })
  }

  // persist the run record
  try {
    await db.run.create({
      data: { id: runId, domain, ...opts, status: 'running', visits: 0, bounces: 0, linksFound: 0 },
    })
  } catch (e) {
    // DB write failed after a successful spawn — stop the engine run again
    await engine.stop(runId).catch(() => undefined)
    return NextResponse.json({ ok: false, error: `Failed to record run: ${(e as Error).message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, runId, domain, options: opts })
}
