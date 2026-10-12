import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { engine } from '@/lib/engine-client'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let runId: string | undefined
  try {
    const body = (await req.json()) as { runId?: string }
    runId = body.runId && body.runId !== 'all' ? body.runId : undefined
  } catch {
    runId = undefined // stop-all
  }

  let result
  try {
    result = await engine.stop(runId)
  } catch {
    return NextResponse.json({ ok: false, error: 'Engine service unreachable.' }, { status: 502 })
  }

  // The engine pushes the final snapshot to /api/engine/sync, which flips the
  // DB row to "stopped". If that callback already landed, the update below is a
  // harmless no-op safeguard.
  if (result.ok && runId) {
    await db.run
      .updateMany({ where: { id: runId, status: 'running' }, data: { status: 'stopped', endedAt: new Date() } })
      .catch(() => undefined)
  }
  return NextResponse.json(result)
}
