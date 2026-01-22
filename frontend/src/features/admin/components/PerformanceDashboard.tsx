import { useEffect, useState } from 'react'
import { getCacheStats, getCacheHealth, getRefreshStatus, clearCache } from '../../../lib/api'

export default function PerformanceDashboard() {
  const [stats, setStats] = useState<{keys: number; approx_bytes: number; hits: number; misses: number} | null>(null)
  const [health, setHealth] = useState<{
    last_refresh: Record<string, string | null>
    next_scheduled_runs: (string | null)[]
    stale_series_count: number
    refresh_in_progress: boolean
    last_run_time: string | null
  } | null>(null)
  const [status, setStatus] = useState<{in_progress: boolean; last_run_time: string | null} | null>(null)
  const [token, setToken] = useState<string>(() => localStorage.getItem('adminToken') || '')

  useEffect(() => {
    const load = async () => {
      try {
        const s = await getCacheStats()
        setStats(s)
        const h = await getCacheHealth()
        setHealth(h)
        const st = await getRefreshStatus()
        setStatus(st)
      } catch {}
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <h3 className="card-title">Performance Dashboard</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <input value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('adminToken', e.target.value) }} placeholder="Admin token" style={{ padding: 6, border: '1px solid var(--color-border)', borderRadius: 6 }} />
          <button className="mini-btn" onClick={async () => { try { await clearCache(token); } catch {} }}>Clear Cache</button>
        </div>
        {stats && (
          <div className="muted">Cache Keys {stats.keys} • Hit Rate {stats.hits + stats.misses > 0 ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100) : 0}% • Approx Size {Math.round(stats.approx_bytes / 1024 / 1024)}MB</div>
        )}
        {health && (
          <div style={{ marginTop: 8 }}>
            <div className="muted">Next runs: {health.next_scheduled_runs.filter(Boolean).join(', ')}</div>
            <div className="muted">Stale series: {health.stale_series_count}</div>
          </div>
        )}
        {status && (
          <div className="muted" style={{ marginTop: 8 }}>Refresh in progress: {status.in_progress ? 'Yes' : 'No'} • Last run: {status.last_run_time || '-'}</div>
        )}
      </div>
    </div>
  )
}
