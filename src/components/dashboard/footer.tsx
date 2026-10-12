'use client'

/**
 * TrafficLab footer — responsible-use notice (preserved) + live system state.
 */
export function DashboardFooter({ connected }: { connected: boolean }) {
  return (
    <footer className="d-flex justify-content-between flex-wrap gap-2 mt-4 small text-mut">
      <span>
        <i className="bi bi-flask1 me-1" aria-hidden="true" />
        TrafficLab v1.1.0 · Bootstrap 5.3 — a testing instrument. Generate traffic only
        toward sites <span className="text-decoration-underline">you own or are authorized to test</span>.
      </span>
      <span className="d-flex align-items-center gap-2">
        <span className={`dot${connected ? '' : ' off'}`} aria-hidden="true" />
        {connected ? 'System online' : 'System offline'} · engine: python · selenium · headless chromium
      </span>
    </footer>
  )
}
