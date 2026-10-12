'use client'

/**
 * useEngineSocket — live layer for TrafficLab.
 *
 * Connects to the engine-service mini-service (socket.io at /?XTransformPort=3003)
 * and exposes: connection state, 1s-tick stats, a rolling log feed and
 * run lifecycle events.
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
    // Connection target for the engine socket layer:
    //  a) Same-origin reverse proxy (recommended for self-hosting): proxy
    //     <site>/engine-socket/* to 127.0.0.1:3003 and build with
    //     NEXT_PUBLIC_ENGINE_SOCK_PATH=/engine-socket/socket.io
    //  b) Dedicated engine origin: build with NEXT_PUBLIC_ENGINE_SOCK_URL=https://engine.example.com
    //  c) Sandbox preview (default): gateway convention /?XTransformPort=3003
    const SOCK_URL  = process.env.NEXT_PUBLIC_ENGINE_SOCK_URL ?? ''
    const SOCK_PATH = process.env.NEXT_PUBLIC_ENGINE_SOCK_PATH ?? ''
    const socket = (SOCK_URL || SOCK_PATH)
      ? io(SOCK_URL || undefined, {
          path: SOCK_PATH || '/socket.io',
          transports: ['websocket', 'polling'],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1500,
        })
      : io('/?XTransformPort=3003', {
          transports: ['websocket', 'polling'],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1500,
        })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('stats', (payload: LiveStats) => setStats(payload))
    socket.on('log', (entry: LogEntry) => {
      setLogs(prev => {
        const next = [...prev, entry]
        return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next
      })
    })
    socket.on('run-ended', (e: RunEndedEvent) => {
      handlersRef.current.forEach(fn => fn(e))
    })

    return () => {
      socket.removeAllListeners()
      socket.close()
      socketRef.current = null
    }
  }, [])

  return { connected, stats, logs, onRunEnded, clearLogs, socket: socketRef }
}
