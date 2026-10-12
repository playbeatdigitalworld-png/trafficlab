import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { engine, type EngineRunSnapshot } from '@/lib/engine-client'

export const runtime = 'nodejs'

/**
 * GET /api/stats
 *
 * Merged view for the dashboard:
 *  - DB aggregates (all-time + last 7 days)
 *  - live engine status (active runs)
 *  - side-effect: syncs active-run counters into the DB and finalizes
 *    orphaned "running" rows (e.g. after an engine-service restart)
 */
export async function GET() {
  // ---- live layer (tolerate the service being down) ------------------------
  let live: { engineReady: boolean; active: EngineRunSnapshot[] } = { engineReady: false, active: [] }
  try {
    const status = await engine.status()
    live = { engineReady: status.engineReady, active: status.active ?? [] }
  } catch {
    live = { engineReady: false, active: [] }
  }

  const activeIds = new Set(live.active.map(r => r.id))

  // keep DB counters fresh for every active run (fire-and-forget batches)
  for (const run of live.active) {
    db.run
      .updateMany({
        where: { id: run.id, status: 'running' },
        data: { visits: run.visits, bounces: run.bounces, linksFound: run.linksFound },
      })
      .catch(() => undefined)
  }

  // finalize rows still marked "running" that the engine no longer knows about
  const stale = await db.run.findMany({ where: { status: 'running' }, select: { id: true } })
  const orphans = stale.filter(r => !activeIds.has(r.id))
  if (orphans.length > 0) {
    await db.run
      .updateMany({
        where: { id: { in: orphans.map(r => r.id) } },
        data: { status: 'interrupted', endedAt: new Date() },
      })
      .catch(() => undefined)
  }

  // ---- DB aggregates -------------------------------------------------------
  const [totals, last7rows] = await Promise.all([
    db.run.aggregate({
      _count: { _all: true },
      _sum: { visits: true, bounces: true, linksFound: true },
      where: { status: { not: 'running' } },
    }),
    db.run.findMany({
      where: { status: { not: 'running' }, startedAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      select: { startedAt: true, visits: true },
    }),
  ])

  // visits per day for the last 7 days (fill gaps with 0)
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)
  const byDay = new Map<string, { label: string; visits: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000)
    byDay.set(dayKey(d), { label: d.toLocaleDateString('en-US', { weekday: 'short' }), visits: 0 })
  }
  for (const row of last7rows) {
    const k = dayKey(new Date(row.startedAt))
    const slot = byDay.get(k)
    if (slot) slot.visits += row.visits
  }

  const totalRuns = await db.run.count()

  return NextResponse.json({
    ok: true,
    engineReady: live.engineReady,
    activeRuns: live.active,
    aggregates: {
      totalRuns,
      totalVisits: totals._sum.visits ?? 0,
      totalBounces: totals._sum.bounces ?? 0,
      totalLinks: totals._sum.linksFound ?? 0,
      activeNow: live.active.length,
      activeThreads: live.active.reduce((n, r) => n + (r.threads || 0), 0),
      visitsPerMinute: live.active.reduce((n, r) => n + (r.minutes?.at(-1)?.visits ?? 0), 0),
    },
    week: Array.from(byDay.values()).map((d, i) => ({ ...d, day: i })),
  })
}
