import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * Internal callback — engine-service POSTs here when a run ends
 * (completed / stopped / failed) with the final snapshot.
 */
interface SyncBody {
  runId?: string
  status?: 'completed' | 'stopped' | 'failed' | 'interrupted'
  reason?: string
  visits?: number
  bounces?: number
  linksFound?: number
  endedAt?: string
  error?: string | null
}

const ALLOWED = new Set(['completed', 'stopped', 'failed', 'interrupted'])

export async function POST(req: Request) {
  let body: SyncBody
  try {
    body = (await req.json()) as SyncBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 })
  }
  if (!body.runId) return NextResponse.json({ ok: false, error: 'runId required.' }, { status: 400 })

  const status = body.status && ALLOWED.has(body.status) ? body.status : 'completed'
  try {
    const updated = await db.run.update({
      where: { id: body.runId },
      data: {
        status,
        visits: Math.max(0, Number(body.visits) || 0),
        bounces: Math.max(0, Number(body.bounces) || 0),
        linksFound: Math.max(0, Number(body.linksFound) || 0),
        endedAt: body.endedAt ? new Date(body.endedAt) : new Date(),
        error: body.error ?? null,
      },
    })
    return NextResponse.json({ ok: true, runId: updated.id, status: updated.status })
  } catch {
    // unknown run id — create a minimal record so history stays complete
    try {
      await db.run.create({
        data: {
          id: body.runId,
          domain: '(recovered by sync)',
          threads: 1, minClicks: 1, maxClicks: 1, timeout: 20, maxOffset: 8,
          secure: true, forever: false, useProxies: false,
          status, visits: Number(body.visits) || 0, bounces: Number(body.bounces) || 0,
          linksFound: Number(body.linksFound) || 0, endedAt: new Date(body.endedAt ?? Date.now()),
          error: body.error ?? null,
        },
      })
      return NextResponse.json({ ok: true, runId: body.runId, status, recovered: true })
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
    }
  }
}
