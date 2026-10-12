'use client'

/**
 * useEngineSocket — live layer for TrafficLab.
 *
 * Connects to the engine-service socket.io layer and exposes: connection
 * state, 1s-tick stats, a rolling log feed and run lifecycle events.
 *
 * Connection strategy (first that works wins):
 *  1. NEXT_PUBLIC_ENGINE_SOCK_URL (build-time)     — dedicated engine origin
 *  2. NEXT_PUBLIC_ENGINE_SOCK_PATH (build-time)    — same-origin reverse proxy
 *     (`bun run build:prod` bakes /engine-socket/socket.io)
 *  3. /?XTransformPort=3003                        — sandbox preview gateway
 *  Self-healing: if the chosen target cannot connect, the hook falls back to
 *  the engine directly on http://localhost:3003 (local dev / pre-deploy
 *  checks), then keeps alternating until something connects. Remote viewers
 *  simply see "Engine offline" while the tunnel is down.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface LiveRun {
  id: string
  domain: string
  status: 'running' | 'completed' | 'stopped' | 'failed'
  threads: number
  startedAt: string
  visits: number
  bounces: number
  linksFound: number
  currentUrl: string | null
  minutes?: { ts: number; visits: number }[]
}

export interface LiveStats {
  ts: number
  engineReady: boolean
  activeRuns: LiveRun[]
}

export interface LogEntry {
  runId: string
  ts: number
  line: string
  kind: 'visit' | 'links' | 'info' | 'error'
  source: 'out' | 'err'
}

export interface RunEndedEvent {
  runId: string
  reason: string
  status: string
}

const MAX_LOGS = 300
const DIRECT_ENGINE = 'http://localhost:3003'

export function useEngineSocket() {
  const socketRef = useRef<Socket | null>(null)
  const handlersRef = useRef<Array<(e: RunEndedEvent) => void>>([])
  const [connected, setConnected] = useState(false)
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const onRunEnded = useCallback((fn: (e: RunEndedEvent) => void) => {
    handlersRef.current.push(fn)
    return () => {
      handlersRef.current = handlersRef.current.filter(h => h !== fn)
    }
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  useEffect(() => {
    const SOCK_URL  = process.env.NEXT_PUBLIC_ENGINE_SOCK_URL ?? ''
    const SOCK_PATH = process.env.NEXT_PUBLIC_ENGINE_SOCK_PATH ?? ''

    const OPTS = {
      // polling first: fails fast (and retries) when a target is unreachable,
      // then upgrades to websocket after the handshake — websocket-first hangs
      // silently on origins without a ws endpoint and stalls self-healing.
      transports: ['polling', 'websocket'] as ('polling' | 'websocket')[],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 6,
      reconnectionDelay: 1500,
    }

    let disposed = false
    let current: Socket | null = null

    const attach = (s: Socket) => {
      s.on('connect', () => setConnected(true))
      s.on('disconnect', () => setConnected(false))
      s.on('stats', (payload: LiveStats) => setStats(payload))
      s.on('log', (entry: LogEntry) => {
        setLogs(prev => {
          const next = [...prev, entry]
          return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next
        })
      })
      s.on('run-ended', (e: RunEndedEvent) => {
        handlersRef.current.forEach(fn => fn(e))
      })
    }

    const swap = (next: Socket) => {
      if (current) {
        current.io.off()
        current.removeAllListeners()
        current.close()
      }
      current = next
      socketRef.current = next
      attach(next)
    }

    // primary target — build-time configured, else the sandbox gateway convention
    const startPrimary = () => {
      if (disposed) return
      const s: Socket = SOCK_URL
        ? io(SOCK_URL, { ...OPTS, path: SOCK_PATH || '/socket.io' })
        : SOCK_PATH
          ? io({ ...OPTS, path: SOCK_PATH })
          : io('/?XTransformPort=3003', OPTS)
      swap(s)
      // self-heal: after 2 failed attempts, try the engine directly
      s.io.on('reconnect_attempt', (attempt: number) => {
        if (disposed) return
        if (attempt >= 2) startDirect()
      })
    }

    // fallback — engine on this machine (local dev / pre-deploy local check).
    // Uses the same path the engine is serving under (SOCK_PATH), or '/' in
    // plain local dev mode.
    const startDirect = () => {
      if (disposed) return
      const s = io(DIRECT_ENGINE, { ...OPTS, path: SOCK_PATH || '/' })
      swap(s)
      // unreachable too (remote viewer, tunnel down) — cycle back to primary
      s.io.on('reconnect_failed', () => {
        if (disposed) return
        setTimeout(() => startPrimary(), 5000)
      })
    }

    startPrimary()

    return () => {
      disposed = true
      if (current) {
        current.io.off()
        current.removeAllListeners()
        current.close()
      }
      socketRef.current = null
    }
  }, [])

  return { connected, stats, logs, onRunEnded, clearLogs, socket: socketRef }
}
