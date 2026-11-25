import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Job } from '../types'

/** Follow a background job over WebSocket, with HTTP polling as a fallback. */
export function useJob(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null)
  useEffect(() => {
    if (!jobId) { setJob(null); return }
    let closed = false
    let poll: number | undefined
    const startPolling = () => {
      if (poll) return
      poll = window.setInterval(async () => {
        try {
          const j = await api.job(jobId)
          if (!closed) setJob(j)
          if (j.status === 'done' || j.status === 'error') clearInterval(poll)
        } catch { /* keep polling */ }
      }, 1500)
    }
    let ws: WebSocket | null = null
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/ws/jobs/${jobId}`)
      ws.onmessage = e => { if (!closed) setJob(JSON.parse(e.data)) }
      ws.onerror = () => startPolling()
      ws.onclose = () => { if (!closed) startPolling() }
    } catch { startPolling() }
    return () => { closed = true; ws?.close(); if (poll) clearInterval(poll) }
  }, [jobId])
  return job
}
