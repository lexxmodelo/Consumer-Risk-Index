import axios from 'axios'

const API_BASE = "https://consumer-risk-index-production-2c83.up.railway.app";
axios.defaults.baseURL = API_BASE;

export type RiskData = {
  level: string
  reasons: string[]
  timestamp: string
  details?: {
    inflation_rate: number
    unemployment_trend: string
    sales_momentum: string
    lag_warning: boolean
  }
}

export type DataPoint = {
  date: string
  indicator_name: string
  value: number
  series_id: string
}

function unwrap<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T
  }
  return payload as T
}

export type Health = { status?: string; components?: any; mode?: string }

export async function getHealth(): Promise<Health> {
  try {
    const res = await axios.get('/api/health')
    return unwrap<Health>(res.data)
  } catch {
    return { mode: 'normal' }
  }
}

export async function getEconomicData() {
  const res = await axios.get('/api/economic-data')
  return unwrap<DataPoint[]>(res.data)
}

export async function getRiskClassification() {
  const res = await axios.get('/api/risk-classification')
  return unwrap<RiskData>(res.data)
}

export async function getRiskTimeline() {
  const res = await axios.get('/api/risk-timeline')
  return unwrap<{ date: string; level: string; score: number }[]>(res.data)
}

export async function getCacheStats() {
  const res = await axios.get('/api/cache-stats')
  return res.data as { keys: number; approx_bytes: number; hits: number; misses: number }
}

export async function clearCache(adminToken?: string) {
  const res = await axios.post('/api/clear-cache', {}, { headers: adminToken ? { 'X-Admin-Token': adminToken } : {} })
  return res.data as { status: string; timestamp: string }
}

export async function getCacheHealth() {
  const res = await axios.get('/api/cache-health')
  return res.data as {
    last_refresh: Record<string, string | null>
    next_scheduled_runs: (string | null)[]
    stale_series_count: number
    refresh_in_progress: boolean
    last_run_time: string | null
    last_error?: string | null
    last_error_at?: string | null
  }
}

export async function getRefreshStatus() {
  const res = await axios.get('/api/refresh-status')
  return res.data as { in_progress: boolean; last_run_time: string | null }
}

export async function dataUpdates(since: string) {
  const res = await axios.get('/api/data-updates', { params: { since } })
  return res.data as {
    data: Record<string, Array<{ date: string; indicator_name: string; value: number; series_id: string }>>
    metadata: { timestamp: string; freshness_minutes: number; cache_status: string; next_refresh: string | null }
  }
}

export async function refreshCache(adminToken?: string) {
  const res = await axios.post('/api/refresh-cache', {}, { headers: adminToken ? { 'X-Admin-Token': adminToken } : {} })
  return res.data as { status: string; timestamp: string }
}
