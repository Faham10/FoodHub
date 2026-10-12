import { useEffect, useRef } from 'react'

export function useAutoRefresh(refresh, intervalMs = 5000) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    let inFlight = false

    const run = async () => {
      if (document.visibilityState === 'hidden' || inFlight) return
      inFlight = true
      try {
        await refreshRef.current()
      } finally {
        inFlight = false
      }
    }

    void run()
    const intervalId = window.setInterval(() => { void run() }, intervalMs)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }

    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [intervalMs, refresh])
}
