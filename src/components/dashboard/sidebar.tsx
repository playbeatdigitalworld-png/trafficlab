'use client'

/**
 * TrafficLab sidebar — premium dark-navy side navigation.
 * Desktop: sticky aside. Mobile (<lg): Bootstrap offcanvas (#tlSidebar).
 * The engine-capacity card shows LIVE data (concurrent sessions / workers).
 */

export const ENGINE_MAX_CONCURRENT_RUNS = 2
export const ENGINE_MAX_THREADS = 4

const NAV_ITEMS: { label: string; icon: string; active?: boolean }[] = [
  { label: 'Dashboard', icon: 'bi-grid-1-2-2', active: true },
  { label: 'Traffic console', icon: 'bi-lightning-charge-fill' },
  { label: 'Analytics', icon: 'bi-graph-up-arrow' },
  { label: 'Reports', icon: 'bi-clipboard-data' },
  { label: 'Settings', icon: 'bi-gear' },
]

/** Skewed-Z gradient logo mark (from the TrafficLab brand assets). */
function LogoMark({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="flex-shrink-0">
      <defs>
        <linearGradient id="tlLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3df5d2" />
          <stop offset="1" stopColor="#13b8e6" />
        </linearGradient>
      </defs>
      <g transform="translate(4 0) skewX(-8)" fill="url(#tlLogoGrad)">
        <rect x="6" y="18" width="30" height="8" rx="1.5" />
        <rect x="17" y="18" width="8" height="36" rx="1.5" />
        <rect x="32" y="30" width="8" height="24" rx="1.5" />
        <rect x="32" y="46" width="22" height="8" rx="1.5" />
      </g>
      <path
        d="M42 24L56 9M47 9H57V19"
        fill="none"
        stroke="url(#tlLogoGrad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SidebarContent({
  activeRuns,
  activeThreads,
}: {
  activeRuns: number
  activeThreads: number
}) {
  const sessionPct = Math.min(100, (activeRuns / ENGINE_MAX_CONCURRENT_RUNS) * 100)
  const workerPct = Math.min(100, (activeThreads / ENGINE_MAX_THREADS) * 100)

  return (
    <>
      <div className="d-flex align-items-center gap-2 px-2 pb-4 tl-brand">
        <LogoMark />
        <div className="lh-1">
          <div className="fs-4 fst-italic" style={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
            Traffic<span className="text-acc">Lab</span>
          </div>
          <small className="text-mut d-block mt-1" style={{ fontSize: '.66rem' }}>
            Traffic simulation &amp; analytics console
          </small>
        </div>
      </div>

      <nav className="nav nav-tl flex-column gap-1" aria-label="Dashboard sections">
        {NAV_ITEMS.map(item => (
          <a
            key={item.label}
            className={`nav-link${item.active ? ' active' : ''}`}
            href={item.active ? '#dashboard' : '#'}
            aria-current={item.active ? 'page' : undefined}
            {...(item.active ? {} : { title: 'Coming soon' })}
            onClick={e => {
              if (!item.active) e.preventDefault()
            }}
          >
            <i className={`bi ${item.icon}`} aria-hidden="true" />
            {item.label}
          </a>
        ))}
      </nav>

      <div className="card p-3 mt-auto">
        <div className="fw-bold mb-2">Engine capacity</div>
        <div className="small d-flex justify-content-between">
          <span className="text-mut">Session slots</span>
          <span className="fw-semibold">
            {activeRuns} / {ENGINE_MAX_CONCURRENT_RUNS}
          </span>
        </div>
        <div className="progress my-2" role="progressbar" aria-label="Concurrent session slots in use" aria-valuenow={activeRuns} aria-valuemin={0} aria-valuemax={ENGINE_MAX_CONCURRENT_RUNS}>
          <div className="progress-bar" style={{ width: `${sessionPct}%` }} />
        </div>
        <div className="small d-flex justify-content-between">
          <span className="text-mut">Browser workers</span>
          <span className="fw-semibold">
            {activeThreads} / {ENGINE_MAX_THREADS}
          </span>
        </div>
        <div className="progress mt-2" role="progressbar" aria-label="Browser workers in use" aria-valuenow={activeThreads} aria-valuemin={0} aria-valuemax={ENGINE_MAX_THREADS}>
          <div className="progress-bar" style={{ width: `${workerPct}%` }} />
        </div>
        <small className="text-mut d-block mt-2">Live engine state, updated every second</small>
      </div>
    </>
  )
}

export function Sidebar({
  activeRuns,
  activeThreads,
}: {
  activeRuns: number
  activeThreads: number
}) {
  return (
    <>
      {/* desktop */}
      <aside className="side d-none d-lg-flex flex-column p-3" aria-label="Sidebar">
        <SidebarContent activeRuns={activeRuns} activeThreads={activeThreads} />
      </aside>

      {/* mobile offcanvas */}
      <div className="offcanvas offcanvas-start" tabIndex={-1} id="tlSidebar" aria-label="Sidebar menu">
        <div className="offcanvas-header">
          <button className="btn-close ms-auto" data-bs-dismiss="offcanvas" aria-label="Close" />
        </div>
        <div className="offcanvas-body d-flex flex-column pt-0">
          <SidebarContent activeRuns={activeRuns} activeThreads={activeThreads} />
        </div>
      </div>
    </>
  )
}
