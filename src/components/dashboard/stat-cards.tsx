'use client'

/**
 * TrafficLab KPI cards — Bootstrap 5.3 glass cards with sparklines.
 * Every number and sparkline is REAL data:
 *  - Live rate: per-minute visits from active runs (teal)
 *  - Page visits: 7-day series from the DB (blue) + today-vs-yesterday delta
 *  - Links discovered: linksFound of the last 8 runs (amber)
 *  - Sessions: visits of the last 8 runs (violet)
 */

export interface StatCardsData {
  activeNow: number
  activeThreads: number
  visitsPerMinute: number
  totalVisits: number
  totalBounces: number
  totalLinks: number
  totalRuns: number
  /** live-only figures (active runs), fall back to 0 */
  liveVisits: number
  /** sparkline sources (real data) */
  weekVisits: number[]
  recentRunVisits: number[]
  recentRunLinks: number[]
  liveMinutes: number[]
}

/** Build a sparkline polyline from real values (min-max normalized). */
function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const pts = (() => {
    const v = values.length ? values : [0]
    const max = Math.max(...v, 1)
    const min = Math.min(...v, 0)
    const range = Math.max(max - min, 1)
    return v
      .map((x, i) => {
        const px = (i / Math.max(v.length - 1, 1)) * 120
        const py = 44 - ((x - min) / range) * 38
        return `${px.toFixed(1)},${py.toFixed(1)}`
      })
      .join(' ')
  })()
  return (
    <svg className="spark" viewBox="0 0 120 50" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  )
}

function KpiCard({
  label,
  valueHtml,
  sub,
  glow,
  children,
}: {
  label: string
  valueHtml: React.ReactNode
  sub: string
  glow: string
  children?: React.ReactNode
}) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div className="card kpi p-3 h-100" style={{ '--g': glow } as React.CSSProperties}>
        <small className="text-mut fw-semibold">{label}</small>
        <div className="val">{valueHtml}</div>
        <small className="text-mut">{sub}</small>
        {children}
      </div>
    </div>
  )
}

export function StatCards({ data }: { data: StatCardsData }) {
  // real delta: today vs yesterday from the 7-day series
  const week = data.weekVisits
  const today = week.at(-1) ?? 0
  const yesterday = week.at(-2) ?? 0
  const delta = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : null

  return (
    <>
      <KpiCard
        label="Live rate"
        valueHtml={
          <>
            {data.visitsPerMinute}
            <small>/min</small>{' '}
            {data.activeNow > 0 && (
              <span className="badge rounded-pill bg-success-subtle text-success-emphasis fs-6 align-middle">
                live
              </span>
            )}
          </>
        }
        sub={`${data.activeNow} session${data.activeNow === 1 ? '' : 's'} · ${data.activeThreads} thread${data.activeThreads === 1 ? '' : 's'} simulating`}
        glow="rgba(25,230,193,.13)"
      >
        <Sparkline values={data.liveMinutes} stroke="#19e6c1" />
      </KpiCard>

      <KpiCard
        label="Page visits"
        valueHtml={
          <>
            {data.totalVisits.toLocaleString()}{' '}
            {delta !== null && (
              <span
                className={`badge rounded-pill fs-6 align-middle ${delta >= 0 ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}`}
              >
                {delta >= 0 ? '+' : ''}
                {delta}%
              </span>
            )}
          </>
        }
        sub={
          data.activeNow > 0
            ? `+${data.liveVisits.toLocaleString()} in active sessions`
            : `${data.totalBounces.toLocaleString()} back-navigations all-time`
        }
        glow="rgba(74,168,255,.13)"
      >
        <Sparkline values={week} stroke="#4aa8ff" />
      </KpiCard>

      <KpiCard
        label="Links discovered"
        valueHtml={<>{data.totalLinks.toLocaleString()}</>}
        sub="across every completed session"
        glow="rgba(255,185,56,.13)"
      >
        <Sparkline values={data.recentRunLinks} stroke="#ffb938" />
      </KpiCard>

      <KpiCard
        label="Sessions"
        valueHtml={
          <>
            {data.totalRuns.toLocaleString()}{' '}
            {data.activeNow > 0 && (
              <span
                className="badge rounded-pill fs-6 align-middle"
                style={{ background: 'rgba(154,123,255,.18)', color: '#b9a4ff' }}
              >
                {data.activeNow} active
              </span>
            )}
          </>
        }
        sub="launched from this console"
        glow="rgba(154,123,255,.15)"
      >
        <Sparkline values={data.recentRunVisits} stroke="#9a7bff" />
      </KpiCard>
    </>
  )
}
