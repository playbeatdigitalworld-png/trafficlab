import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** GET /api/runs?limit=50 — run history (newest first) */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200)

  const runs = await db.run.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      domain: true,
      status: true,
      threads: true,
      minClicks: true,
      maxClicks: true,
      timeout: true,
      maxOffset: true,
      secure: true,
      forever: true,
      useProxies: true,
      visits: true,
      bounces: true,
      linksFound: true,
      startedAt: true,
      endedAt: true,
      error: true,
    },
  })
  return NextResponse.json({ ok: true, runs })
}
