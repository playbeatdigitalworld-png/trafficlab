'use client'

/**
 * TrafficLab — dashboard page (Bootstrap 5.3 premium UI).
 *
 * Data flow (unchanged):
 *  - live layer:   engine-service (socket.io, 1s ticks + log stream)
 *  - history layer: Next.js API (/api/stats, /api/runs) via TanStack Query
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useEngineSocket, type LiveRun } from '@/hooks/use-engine-socket'
import { Sidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { StatCards } from '@/components/dashboard/stat-cards'
import {
  LaunchConsole,
  type LaunchOptions,
} from '@/components/dashboard/launch-console'
import { LiveMonitor } from '@/components/dashboard/live-monitor'
import { TrafficCharts } from '@/components/dashboard/traffic-charts'
import { HistoryTable, type HistoryRun } from '@/components/dashboard/history-table'
import { DashboardFooter } from '@/components/dashboard/footer'

interface StatsResponse {
  ok: boolean
  engineReady: boolean
  activeRuns: LiveRun[]
  aggregates: {
    totalRuns: number
    totalVisits: number
    totalBounces: number
    totalLinks: number
    activeNow: number
    activeThreads: number
    visitsPerMinute: number
  }
  week: { label: string; visits: number; day: number }[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export default function TrafficLabDashboard() {
  const queryClient = useQueryClient()
  const { connected, stats, logs, onRunEnded, clearLogs } = useEngineSocket()
  const [busy, setBusy] = useState(false)

  // ---- history + aggregates (poll) -----------------------------------------
  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => getJson<StatsResponse>('/api/stats'),
    refetchInterval: 5000,
  })
  const runsQuery = useQuery({
    queryKey: ['runs'],
    queryFn: () => getJson<{ ok: boolean; runs: HistoryRun[] }>('/api/runs?limit=50'),
    refetchInterval: 8000,
  })

  // when a run ends, refresh history + stats immediately
  useEffect(() => {
    const off = onRunEnded(e => {
      toast.success(`Session for ${e.runId.slice(0, 8)}… ended: ${e.status}`)
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    })
    return off
  }, [onRunEnded, queryClient])

  const engineReady = stats?.engineReady ?? statsQuery.data?.engineReady ?? true
  const activeRuns: LiveRun[] = useMemo(
    () => stats?.activeRuns ?? statsQuery.data?.activeRuns ?? [],
    [stats, statsQuery.data],
  )
  const historyRuns = useMemo(() => runsQuery.data?.runs ?? [], [runsQuery.data])

  // ---- actions --------------------------------------------------------------
  const launch = useCallback(async (opts: LaunchOptions): Promise<{ ok: boolean; error?: string }> => {
    setBusy(true)
    try {
      const res = await fetch('/api/engine/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(opts),
      })
      const data = (await res.json()) as { ok: boolean; error?: string; domain?: string }
      if (data.ok) {
        toast.success(`Session launched — simulating visitors on ${data.domain}`)
        queryClient.invalidateQueries({ queryKey: ['stats'] })
        queryClient.invalidateQueries({ queryKey: ['runs'] })
        return { ok: true }
      }
      return { ok: false, error: data.error ?? 'Launch failed.' }
    } catch {
      return { ok: false, error: 'Could not reach the server.' }
    } finally {
      setBusy(false)
    }
  }, [queryClient])

  const stop = useCallback(
    async (runId?: string) => {
      try {
        const res = await fetch('/api/engine/stop', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(runId ? { runId } : {}),
        })
        const data = (await res.json()) as { ok: boolean; stopped?: string[] }
        if (data.ok) toast.info(`Stopped ${data.stopped?.length ?? 0} session(s)`)
        else toast.error('Nothing to stop.')
      } catch {
        toast.error('Could not reach the server.')
      } finally {
        queryClient.invalidateQueries({ queryKey: ['stats'] })
        queryClient.invalidateQueries({ queryKey: ['runs'] })
      }
    },
    [queryClient],
  )

  // ---- derived card data (real sparkline sources) ---------------------------
  const agg = statsQuery.data?.aggregates
  const activeThreads = activeRuns.reduce((n, r) => n + (r.threads || 0), 0)
  const cards = {
    activeNow: activeRuns.length,
    activeThreads,
    visitsPerMinute: activeRuns.reduce((n, r) => n + (r.minutes?.at(-1)?.visits ?? 0), 0),
    totalVisits: agg?.totalVisits ?? 0,
    totalBounces: agg?.totalBounces ?? 0,
    totalLinks: agg?.totalLinks ?? 0,
    totalRuns: agg?.totalRuns ?? 0,
    liveVisits: activeRuns.reduce((n, r) => n + r.visits, 0),
    weekVisits: (statsQuery.data?.week ?? []).map(d => d.visits),
    recentRunVisits: historyRuns.slice(0, 8).map(r => r.visits).reverse(),
    recentRunLinks: historyRuns.slice(0, 8).map(r => r.linksFound).reverse(),
    liveMinutes: activeRuns.flatMap(r => (r.minutes ?? []).slice(-8).map(m => m.visits)),
  }

  return (
    <div className="tl-app d-flex">
      <Sidebar activeRuns={activeRuns.length} activeThreads={activeThreads} />

      <main className="flex-grow-1 p-3 p-lg-4" id="dashboard" style={{ minWidth: 0 }}>
        <DashboardHeader connected={connected} engineReady={engineReady} />

        {!engineReady && (
          <div
            className="alert py-2 small d-flex align-items-center gap-2 mb-4"
            role="alert"
            style={{ background: 'rgba(255,185,56,.08)', border: '1px solid rgba(255,185,56,.35)', color: 'var(--tl-amb)' }}
          >
            <i className="bi bi-exclamation-triangle" aria-hidden="true" />
            <span>
              <b>Engine not ready.</b> The Python engine (Website-Traffic-Generator project) is not
              available on this machine. Launching is disabled until it is back.
            </span>
          </div>
        )}

        <div className="row g-3 g-lg-4">
          <StatCards data={cards} />

          <LaunchConsole
            disabled={!engineReady}
            busy={busy}
            activeCount={activeRuns.length}
            onLaunch={launch}
            onStopAll={() => stop()}
          />
          <LiveMonitor
            runs={activeRuns}
            logs={logs}
            connected={connected}
            onClear={clearLogs}
            onStop={id => stop(id)}
          />

          <TrafficCharts runs={activeRuns} week={statsQuery.data?.week ?? []} />

          <HistoryTable runs={historyRuns} />
        </div>

        <DashboardFooter connected={connected} />
      </main>
    </div>
  )
}
