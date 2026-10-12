/**
 * Server-side client for the engine-service mini-service.
 * (Called from Next.js API routes only — direct localhost, no gateway.)
 */
// Server-side REST base of the engine-service. Override with ENGINE_REST_URL
// when the engine runs on a different machine (hybrid deployments).
const BASE = process.env.ENGINE_REST_URL ?? 'http://127.0.0.1:3004'

export interface EngineRunSnapshot {
  id: string
  domain: string
  status: 'running' | 'completed' | 'stopped' | 'failed'
  threads: number
  secure: boolean
  forever: boolean
  startedAt: string
  endedAt: string | null
  visits: number
  bounces: number
  linksFound: number
  currentUrl: string | null
  lastEventTs: string | null
  error: string | null
  minutes?: { ts: number; visits: number }[]
}

export interface EngineStatus {
  ok: boolean
  engineReady: boolean
  activeRunIds: string[]
  active: EngineRunSnapshot[]
  recent: EngineRunSnapshot[]
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(5000),
  })
  return (await res.json()) as T
}

export const engine = {
  status: () => call<EngineStatus>('/status'),
  start: (payload: Record<string, unknown>) =>
    call<{ ok: boolean; error?: string }>('/start', { method: 'POST', body: JSON.stringify(payload) }),
  stop: (runId?: string) =>
    call<{ ok: boolean; stopped: string[]; error?: string }>('/stop', {
      method: 'POST',
      body: JSON.stringify(runId ? { runId } : {}),
    }),
}
