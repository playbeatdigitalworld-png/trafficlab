'use client'

/**
 * TrafficLab session history — Bootstrap 5.3 table with status pills.
 * Data + formatting preserved: responsive column hiding, duration,
 * started time, empty state, per-row error tooltip.
 */

export interface HistoryRun {
  id: string
  domain: string
  status: string
  threads: number
  maxClicks: number
  visits: number
  bounces: number
  linksFound: number
  startedAt: string
  endedAt: string | null
  error: string | null
}

function fmtDuration(startedAt: string, endedAt: string | null) {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const s = Math.max(0, Math.floor((end - start) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export function HistoryTable({ runs }: { runs: HistoryRun[] }) {
  return (
    <section className="col-12" aria-label="Session history">
      <div className="card p-3 p-md-4 tl-rise" style={{ animationDelay: '.24s' }}>
        <div className="d-flex align-items-center mb-2">
          <h2 className="h6 fw-bold mb-0">Session history</h2>
          <span className="ms-auto small text-mut">{runs.length} recent session{runs.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-responsive tl-scroll" style={{ maxHeight: '26rem', overflowY: 'auto' }}>
          <table className="table table-hover align-middle mb-0">
            <thead className="position-sticky top-0" style={{ background: 'var(--tl-card)', backdropFilter: 'blur(14px)' }}>
              <tr>
                <th scope="col">Domain</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-end">Visits</th>
                <th scope="col" className="text-end d-none d-sm-table-cell">Back</th>
                <th scope="col" className="text-end d-none d-sm-table-cell">Links</th>
                <th scope="col" className="text-end d-none d-md-table-cell">Workers</th>
                <th scope="col" className="text-end d-none d-md-table-cell">Duration</th>
                <th scope="col" className="text-end d-none d-lg-table-cell">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-5 text-center text-mut small">
                    No sessions yet — your launch history will appear here.
                  </td>
                </tr>
              ) : (
                runs.map(run => (
                  <tr key={run.id} title={run.error ?? undefined}>
                    <td className="fw-bold text-truncate" style={{ maxWidth: 220, fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.8rem' }}>
                      {run.domain}
                    </td>
                    <td>
                      <span className={`badge-s b-${run.status}`}>{run.status}</span>
                    </td>
                    <td className="text-end text-acc" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.8rem' }}>
                      {run.visits.toLocaleString()}
                    </td>
                    <td className="text-end text-mut d-none d-sm-table-cell" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.8rem' }}>
                      {run.bounces.toLocaleString()}
                    </td>
                    <td className="text-end d-none d-sm-table-cell" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.8rem', color: 'var(--tl-amb)' }}>
                      {run.linksFound.toLocaleString()}
                    </td>
                    <td className="text-end text-mut d-none d-md-table-cell" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.8rem' }}>
                      {run.threads}
                    </td>
                    <td className="text-end text-mut d-none d-md-table-cell" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.8rem' }}>
                      {fmtDuration(run.startedAt, run.endedAt)}
                    </td>
                    <td className="text-end text-mut d-none d-lg-table-cell" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: '.8rem' }}>
                      {new Date(run.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
