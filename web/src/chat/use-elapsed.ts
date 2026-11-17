import { useEffect, useState } from 'react'

const TICK_MS = 500

// Whole seconds since startedAt, refreshed twice a second while isRunning. The text it feeds is never a live region.
export function useElapsedSeconds(startedAt: number, isRunning: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isRunning) return
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [isRunning])
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

export function formatSeconds(ms: number): string {
  return `${Math.max(1, Math.round(ms / 1000))}s`
}

// "3.4 s" for how long an answer took. Whole-second "12s" is only for the live thinking counter.
export function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}
