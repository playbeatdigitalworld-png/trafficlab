'use client'

/**
 * TrafficLab live monitor — Bootstrap 5.3.
 * Logic preserved: active run cards (stop per run), rolling engine log feed
 * with auto-scroll, clear-feed action. Progress bars show REAL engine load.
 */
import { useEffect, useRef } from 'react'
import type { LiveRun, LogEntry } from '@/hooks/use-engine-socket'
import { ENGINE_MAX_CONCURRENT_RUNS, ENGINE_MAX_THREADS } from '@/components/dashboard/sidebar'

function elapsed(startedAt: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function fmtTime(ts: number) {
  return new Date(ts).toTimeString().slice(0, 8)
}

function RunCard({ run, onStop }: { run: LiveRun; onStop: (id: string) => void }) {
  return (
    <div className="run-card">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2">
        <div className="d-flex min-w-0 align-items-center gap-2">
          <span className="dot" aria-hidden="true" />
          <p className="mb-0 fw-semibold small text-truncate" style={{ fontFamily: 'var(--font-plex-mono), monospace' }}>
            {run.domain}
          </p>
          <span className="badge rounded-pill text-bg-secondary fw-semibold" style={{ fontSize: '.66rem' }}>
            <i className="bi bi-stopwatch me-1" aria-hidden="true" />
            {elapsed(run.startedAt)}
          </span>
        </div>
        <div className="d-flex align-items-center gap-3 small" style={{ fontFamily: 'var(--font-plex-mono), monospace' }}>
          <span className="text-acc" title="Page visits">
            <i className="bi bi-hand-index-thumb me-1" aria-hidden="true" />
            {run.visits}
          </span>
          <span className="text-mut" title="Back-navigations">
            <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
            {run.bounces}
          </span>
          <span title="Links found" style={{ color: 'var(--tl-amb)' }}>
            <i className="bi bi-link-45deg me-1" aria-hidden="true" />
            {run.linksFound}
          </span>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm py-0 px-2"
            style={{ fontSize: '.72rem' }}
            onClick={() => onStop(run.id)}
          >
            <i className="bi bi-slash-circle me-1" aria-hidden="true" />
            Stop
          </button>
        </div>
      </div>
      {run.currentUrl && (
        <div className="urlbar d-flex align-items-center gap-2 px-3 py-2">
          <i className="bi bi-compass text-mut" aria-hidden="true" />
          <p className="mb-0 text-truncate text-mut" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.72rem' }} title={run.currentUrl}>
            {run.currentUrl}
          </p>
        </div>
      )}
    </div>
  )
}

const KIND_CLASS: Record<LogEntry['kind'], string> = {
  visit: 'ok',
  links: 'w',
  info: 'dim',
  error: 'bad',
}

export function LiveMonitor({
  runs,
  logs,
  connected,
  onClear,
  onStop,
}: {
  runs: LiveRun[]
  logs: LogEntry[]
  connected: boolean
  onClear: () => void
  onStop: (id: string) => void
}) {
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length])

  const activeThreads = runs.reduce((n, r) => n + (r.threads || 0), 0)
  const workerPct = Math.min(100, (activeThreads / ENGINE_MAX_THREADS) * 100)
  const sessionPct = Math.min(100, (runs.length / ENGINE_MAX_CONCURRENT_RUNS) * 100)

  const statusText =
    runs.length === 0
      ? connected
        ? 'No active sessions. Launch one from the console to see live activity.'
        : 'Connecting to the engine service…'
      : `${runs.length} session${runs.length === 1 ? '' : 's'} running · ${activeThreads} worker${activeThreads === 1 ? '' : 's'} · ${runs.map(r => r.domain).join(', ')}`

  return (
    <section className="col-12 col-xl-6" aria-label="Live monitor">
      <div className="card p-3 p-md-4 h-100 d-flex flex-column tl-rise" style={{ animationDelay: '.06s' }}>
        <div className="d-flex align-items-center mb-3">
          <h2 className="h6 fw-bold mb-0">Live monitor</h2>
          <a
            href="#"
            className="ms-auto small text-mut text-decoration-none"
            onClick={e => {
              e.preventDefault()
              onClear()
            }}
          >
            Clear feed
          </a>
        </div>

        {/* status line */}
        <div
          className="py-2 px-3 small d-flex align-items-center gap-2 mb-3"
          style={{
            background: runs.length > 0 ? 'rgba(25,230,193,.08)' : 'transparent',
            border: '1px solid var(--bs-border-color)',
            borderRadius: '0.8rem',
            color: runs.length > 0 ? 'var(--tl-acc)' : 'var(--tl-mut)',
          }}
          role="status"
        >
          <span className={`dot${runs.length > 0 ? '' : ' off'}`} aria-hidden="true" />
          {statusText}
        </div>

        {/* active runs */}
        <div className="d-flex flex-column gap-2 mb-3" aria-live="polite">
          {runs.length === 0
            ? null
            : runs.map(run => <RunCard key={run.id} run={run} onStop={onStop} />)}
        </div>

        {/* terminal feed */}
        <div
          ref={feedRef}
          className="log flex-grow-1"
          role="log"
          aria-label="Engine output feed"
          style={{ minHeight: 220, maxHeight: 260 }}
        >
          {logs.length === 0 ? (
            <div className="dim">
              {connected ? 'waiting for engine output…' : 'connecting to engine service…'}
            </div>
          ) : (
            logs.slice(-120).map((e, i) => (
              <div key={`${e.ts}-${i}`} className="text-break">
                <i>[{fmtTime(e.ts)}]</i>
                <span className={KIND_CLASS[e.kind]}>{e.line}</span>
              </div>
            ))
          )}
        </div>

        {/* real engine load */}
        <div className="row g-3 mt-1 small">
          <div className="col-6">
            <div className="d-flex justify-content-between">
              <span className="text-mut">Worker load</span>
              <b>{activeThreads} / {ENGINE_MAX_THREADS}</b>
            </div>
            <div className="progress mt-1" role="progressbar" aria-label="Worker load" aria-valuenow={activeThreads} aria-valuemin={0} aria-valuemax={ENGINE_MAX_THREADS}>
              <div className="progress-bar" style={{ width: `${workerPct}%` }} />
            </div>
          </div>
          <div className="col-6">
            <div className="d-flex justify-content-between">
              <span className="text-mut">Session slots</span>
              <b>{runs.length} / {ENGINE_MAX_CONCURRENT_RUNS}</b>
            </div>
            <div className="progress mt-1" role="progressbar" aria-label="Session slots in use" aria-valuenow={runs.length} aria-valuemin={0} aria-valuemax={ENGINE_MAX_CONCURRENT_RUNS}>
              <div className="progress-bar" style={{ width: `${sessionPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
