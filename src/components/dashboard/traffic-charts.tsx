'use client'

/**
 * TrafficLab charts — recharts restyled to the premium teal theme.
 * Data logic preserved 1:1: live rate = per-minute buckets of active runs
 * (30-min zero-filled window); weekly = visits/day from DB aggregates.
 */
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LiveRun } from '@/hooks/use-engine-socket'

interface WeekPoint {
  label: string
  visits: number
}

const TOOLTIP_STYLE = {
  background: 'rgba(9,20,27,.94)',
  border: '1px solid rgba(120,255,226,.18)',
  borderRadius: 10,
  fontSize: 12,
  color: '#e8f6f3',
  backdropFilter: 'blur(10px)',
} as const

/** Live rate chart — merged per-minute buckets of all active runs (last 30 min). */
function LiveRateChart({ runs }: { runs: LiveRun[] }) {
  const data = useMemo(() => {
    const byMinute = new Map<number, number>()
    const now = Math.floor(Date.now() / 60_000) * 60_000
    for (let i = 29; i >= 0; i--) byMinute.set(now - i * 60_000, 0) // zero-filled window
    for (const run of runs) {
      for (const m of run.minutes ?? []) {
        if (byMinute.has(m.ts)) byMinute.set(m.ts, (byMinute.get(m.ts) ?? 0) + m.visits)
      }
    }
    return Array.from(byMinute.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, visits]) => ({
        t: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        visits,
      }))
  }, [runs])

  const last = data.at(-1)?.visits ?? 0
  const total = data.reduce((n, d) => n + d.visits, 0)

  return (
    <section className="col-12 col-xl-7" aria-label="Traffic rate chart">
      <div className="card p-3 p-md-4 h-100 tl-chart tl-rise" style={{ animationDelay: '.12s' }}>
        <div className="d-flex align-items-center mb-2">
          <h2 className="h6 fw-bold mb-0">Traffic rate</h2>
          <span className="chip px-2 py-1 small ms-auto d-flex align-items-center gap-2 text-acc">
            <span className={`dot${last > 0 ? '' : ' off'}`} aria-hidden="true" />
            {last}/min now
          </span>
        </div>
        <div className="text-mut small mb-2">{total.toLocaleString()} visits in the last 30 minutes</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="tlRateFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19e6c1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#19e6c1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(120,200,190,.15)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: '#7f9a9c', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fill: '#7f9a9c', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#7f9a9c' }} cursor={{ stroke: 'rgba(25,230,193,.3)' }} />
              <Area
                type="monotone"
                dataKey="visits"
                name="visits/min"
                stroke="#19e6c1"
                strokeWidth={2.5}
                strokeLinejoin="round"
                fill="url(#tlRateFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

/** History chart — visits per day for the last 7 days (from the DB aggregates). */
function WeeklyChart({ week }: { week: WeekPoint[] }) {
  const total = week.reduce((n, d) => n + d.visits, 0)
  const max = Math.max(...week.map(d => d.visits), 1)

  return (
    <section className="col-12 col-xl-5" aria-label="Traffic generated per day">
      <div className="card p-3 p-md-4 h-100 tl-chart tl-rise" style={{ animationDelay: '.18s' }}>
        <div className="d-flex align-items-center mb-3">
          <h2 className="h6 fw-bold mb-0">Traffic generated</h2>
          <small className="ms-auto text-mut">{total.toLocaleString()} visits / 7 days</small>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={week} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="tlBarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19e6c1" />
                  <stop offset="100%" stopColor="rgba(25,230,193,.15)" />
                </linearGradient>
                <linearGradient id="tlBarPeak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffb938" />
                  <stop offset="100%" stopColor="rgba(255,185,56,.15)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(120,200,190,.15)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#7f9a9c', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#7f9a9c', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(25,230,193,.06)' }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#7f9a9c' }}
              />
              <Bar dataKey="visits" name="visits" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false}>
                {week.map((d, i) => (
                  <Cell key={i} fill={d.visits === max && d.visits > 0 ? 'url(#tlBarPeak)' : 'url(#tlBarFill)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

export function TrafficCharts({ runs, week }: { runs: LiveRun[]; week: WeekPoint[] }) {
  return (
    <>
      <LiveRateChart runs={runs} />
      <WeeklyChart week={week} />
    </>
  )
}
