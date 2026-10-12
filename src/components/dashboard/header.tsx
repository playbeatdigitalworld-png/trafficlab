'use client'

/**
 * TrafficLab header — Bootstrap 5.3 top bar.
 * All chips reflect real state: engine readiness, socket connection.
 * Theme toggle switches data-bs-theme (dark ⇄ light) and persists to localStorage.
 */

const REPO_URL = 'https://github.com/playbeatdigitalworld-png/website-traffic-generator'

export function DashboardHeader({
  connected,
  engineReady,
}: {
  connected: boolean
  engineReady: boolean
}) {
  const toggleTheme = () => {
    const root = document.documentElement
    const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark'
    root.setAttribute('data-bs-theme', next)
    try {
      localStorage.setItem('tl-theme', next)
    } catch {
      /* private mode — ignore */
    }
  }

  return (
    <header className="d-flex align-items-center gap-2 gap-md-3 mb-4 flex-wrap">
      {/* mobile menu */}
      <button
        className="btn btn-outline-secondary d-lg-none"
        type="button"
        data-bs-toggle="offcanvas"
        data-bs-target="#tlSidebar"
        aria-controls="tlSidebar"
        aria-label="Open menu"
      >
        <i className="bi bi-list" aria-hidden="true" />
      </button>

      <div>
        <h1 className="h3 fw-bold mb-0">Dashboard</h1>
        <small className="text-mut">Test traffic for sites you own or are authorized to test</small>
      </div>

      <div className="ms-auto d-flex align-items-center gap-2">
        {/* engine state (real) */}
        {engineReady ? null : (
          <span className="chip px-3 py-1 small fw-semibold d-none d-sm-inline-flex align-items-center gap-2" title="Python engine is not available on this machine">
            <i className="bi bi-exclamation-triangle" style={{ color: 'var(--tl-amb)' }} aria-hidden="true" />
            <span style={{ color: 'var(--tl-amb)' }}>engine offline</span>
          </span>
        )}

        {/* live socket state (real) */}
        <span
          className="chip px-3 py-1 small fw-semibold d-none d-sm-inline-flex align-items-center gap-2"
          title={connected ? 'Realtime feed connected' : 'Realtime feed disconnected'}
        >
          <span className={`dot${connected ? '' : ' off'}`} aria-hidden="true" />
          {connected ? 'Live' : 'Offline'}
        </span>

        {/* theme toggle (real, persisted) */}
        <button className="btn btn-outline-secondary" type="button" onClick={toggleTheme} aria-label="Toggle dark / light theme">
          <i className="bi bi-moon-stars d-dark-theme-inline" aria-hidden="true" />
          <i className="bi bi-sun d-light-theme-inline" aria-hidden="true" />
        </button>

        {/* account / info dropdown */}
        <div className="dropdown">
          <button
            className="btn p-0"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            aria-label="Account menu"
          >
            <span
              className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold"
              style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#3df5d2,#13b8e6)', color: '#03130f' }}
            >
              TL
            </span>
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li>
              <span className="dropdown-item-text small">
                <span className="d-block fw-bold">TrafficLab console</span>
                <span className="text-mut">v1.1.0 · Bootstrap 5.3</span>
              </span>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <a className="dropdown-item" href={REPO_URL} target="_blank" rel="noreferrer">
                <i className="bi bi-github me-2" aria-hidden="true" />
                Engine source (GitHub)
              </a>
            </li>
            <li>
              <span className="dropdown-item-text small d-flex align-items-center gap-2">
                <span className={`dot${engineReady ? '' : ' off'}`} aria-hidden="true" />
                {engineReady ? 'Engine online' : 'Engine offline'}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </header>
  )
}
