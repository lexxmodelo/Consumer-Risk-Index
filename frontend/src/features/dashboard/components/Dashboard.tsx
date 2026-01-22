import { useEffect, useState, useCallback, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, ReferenceLine, ReferenceDot } from 'recharts'
import type { ChartData } from '../../../types/chart'
import { getEconomicData, getHealth, getRiskClassification, getRiskTimeline, dataUpdates, getCacheStats, type DataPoint, type RiskData } from '../../../lib/api'
import RiskPanel, { CurrentRiskData } from '../../risk/components/RiskPanel'
import RiskDriversPanel from '../../risk/components/RiskDriversPanel'
import { computeRiskConfidence } from '../../risk/components/RiskConfidenceIndicator'
import MethodologyDrawer from '../../methodology/components/MethodologyDrawer'
import ComparisonSummaryCard from './ComparisonSummaryCard'
import { recessionPeriods, keyEvents } from '../data/events'
import { DashboardTooltip } from './DashboardTooltip'

const SERIES_COLORS: Record<string, string> = {
  'CPI (Consumer Price Index)': '#F59E0B',
  'Unemployment Rate': '#2563EB',
  'Federal Funds Rate': '#7C3AED',
  'Retail Sales': '#10B981',
  'Consumer Credit': '#EF4444',
}

export default function Dashboard() {
  const [data, setData] = useState<ChartData[]>([])
  const [risk, setRisk] = useState<RiskData | null>(null)
  const [riskTimeline, setRiskTimeline] = useState<{date: string; level: string; score: number}[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'normal' | 'api_only'>('normal')
  const [timeRange, setTimeRange] = useState<'5Y' | '15Y' | '25Y'>('25Y')
  const [seriesVisible, setSeriesVisible] = useState<Record<string, boolean>>({
    'CPI (Consumer Price Index)': true,
    'Unemployment Rate': true,
    'Federal Funds Rate': true,
    'Retail Sales': true,
    'Consumer Credit': true,
  })
  const [useNormalized, setUseNormalized] = useState(false)
  const [isYoYModeActive, setIsYoYModeActive] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [isMaVisible, _setIsMaVisible] = useState(false)
  const [maPeriod, _setMaPeriod] = useState(6)
  const isDark = typeof document !== 'undefined' && document.body.classList.contains('theme-dark')
  const isSmall = typeof window !== 'undefined' && window.innerWidth <= 1024
  const [lastUpdateTs, setLastUpdateTs] = useState<string | null>(null)
  const [_cacheStats, setCacheStats] = useState<{keys: number; approx_bytes: number; hits: number; misses: number} | null>(null)
  const [lagInsight, setLagInsight] = useState<string>('')
  const [showMethodology, setShowMethodology] = useState(false)
  const [snapshotCollapsed, setSnapshotCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const val = localStorage.getItem('snapshotCollapsed.dashboard')
    return val === 'true'
  })

  // Compare Mode State
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [compareStart, setCompareStart] = useState<string | null>(null)
  const [compareEnd, setCompareEnd] = useState<string | null>(null)

  const handleCompareToggle = () => {
    if (isCompareMode) {
      setIsCompareMode(false)
      setCompareStart(null)
      setCompareEnd(null)
    } else {
      setIsCompareMode(true)
    }
  }

  const handleChartClick = (e: any) => {
    if (!isCompareMode || !e || !e.activeLabel) return
    const clickedTs = e.activeLabel
    const sourceData = isYoYModeActive ? yoyData : (useNormalized ? normalizedData : displayData)
    const d = sourceData.find(item => item.timestamp === clickedTs)
    if (!d) return
    const date = d.date

    if (!compareStart) {
      setCompareStart(date)
    } else if (!compareEnd) {
      if (new Date(date) < new Date(compareStart)) {
        setCompareEnd(compareStart)
        setCompareStart(date)
      } else {
        setCompareEnd(date)
      }
    } else {
      // Start over
      setCompareStart(date)
      setCompareEnd(null)
    }
  }

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        const health = await getHealth()
        setMode(health?.mode === 'api_only' ? 'api_only' : 'normal')

        const [rawData, riskData, timelineData] = await Promise.all([
          getEconomicData(),
          getRiskClassification(),
          getRiskTimeline(),
        ]) as [DataPoint[], RiskData, {date: string; level: string; score: number}[]]
        
        if (!Array.isArray(rawData)) {
          throw new Error('Economic data format invalid')
        }

        const monthlyIds = new Set(['UNRATE', 'CPIAUCSL', 'FEDFUNDS', 'RSAFS'])
        const monthlyNames = ['Unemployment Rate', 'CPI (Consumer Price Index)', 'Federal Funds Rate', 'Retail Sales']
        const weeklyId = 'CCLACBW027SBOG'
        const weeklyName = 'Consumer Credit'
        const monthlyItems = rawData.filter(d => monthlyIds.has(d.series_id))
        const weeklyItems = rawData
          .filter(d => d.series_id === weeklyId)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        const monthlyByDate: { [date: string]: ChartData } = {}
        monthlyItems.forEach(item => {
          if (!monthlyByDate[item.date]) monthlyByDate[item.date] = { date: item.date }
          monthlyByDate[item.date][item.indicator_name] = item.value
        })
        const monthlyDates = Object.keys(monthlyByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        const lastMonthly: Record<string, number | undefined> = {}
        monthlyDates.forEach(date => {
          monthlyNames.forEach(name => {
            const val = monthlyByDate[date][name] as number | undefined
            if (val === undefined && lastMonthly[name] !== undefined) {
              monthlyByDate[date][name] = lastMonthly[name] as number
            } else if (val !== undefined) {
              lastMonthly[name] = val
            }
          })
        })
        let j = 0
        let lastWeeklyVal: number | undefined = undefined
        monthlyDates.forEach(date => {
          const md = new Date(date).getTime()
          while (j < weeklyItems.length && new Date(weeklyItems[j].date).getTime() <= md) {
            lastWeeklyVal = weeklyItems[j].value
            j++
          }
          if (lastWeeklyVal !== undefined) {
            monthlyByDate[date][weeklyName] = lastWeeklyVal
          }
        })
        const chartData = monthlyDates.map(date => ({
          ...monthlyByDate[date],
          timestamp: new Date(date).getTime(),
        }))
        setData(chartData)
        setLastUpdateTs(new Date().toISOString())

        setRisk(riskData)
        setRiskTimeline(timelineData)

        setError(null)
      } catch (err) {
        console.error('Error loading dashboard:', err)
        setError('Failed to load data. Please check if the backend is running.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])
  useEffect(() => {
    const loadStats = async () => {
      try {
        const cs = await getCacheStats()
        setCacheStats(cs)
      } catch {}
    }
    loadStats()
    const id = setInterval(loadStats, 60000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    const poll = async () => {
      try {
        const since = lastUpdateTs || new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const upd = await dataUpdates(since)
        const grouped = upd.data
        const monthlyIds = new Set(['UNRATE', 'CPIAUCSL', 'FEDFUNDS', 'RSAFS'])
        const weeklyId = 'CCLACBW027SBOG'
        const weeklyName = 'Consumer Credit'
        const monthlyByDate: { [date: string]: ChartData } = {}
        const weeklyItems: Array<{ date: string; value: number }> = []
        Object.keys(grouped).forEach(sid => {
          const arr = grouped[sid] || []
          if (sid === weeklyId) {
            arr.forEach(item => weeklyItems.push({ date: item.date, value: item.value }))
            return
          }
          if (!monthlyIds.has(sid)) return
          arr.forEach(item => {
            const date = item.date
            const name = item.indicator_name
            if (!monthlyByDate[date]) monthlyByDate[date] = { date }
            monthlyByDate[date][name] = item.value
          })
        })
        const merged = [...data]
        Object.keys(monthlyByDate).forEach(date => {
          const idx = merged.findIndex(d => d.date === date)
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...monthlyByDate[date] }
          } else {
            merged.push(monthlyByDate[date])
          }
        })
        merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        if (weeklyItems.length) {
          weeklyItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          let j = 0
          let lastWeeklyVal: number | undefined = undefined
          for (let i = 0; i < merged.length; i++) {
            const md = new Date(merged[i].date).getTime()
            while (j < weeklyItems.length && new Date(weeklyItems[j].date).getTime() <= md) {
              lastWeeklyVal = weeklyItems[j].value
              j++
            }
            if (lastWeeklyVal !== undefined) {
              merged[i][weeklyName] = lastWeeklyVal
            }
          }
        }
        setData(merged.map(d => ({ ...d, timestamp: new Date(d.date).getTime() })))
        setLastUpdateTs(new Date().toISOString())
      } catch {}
    }
    const id = setInterval(poll, 300000)
    return () => clearInterval(id)
  }, [data, lastUpdateTs])

  const monthsForRange = timeRange === '5Y' ? 60 : timeRange === '15Y' ? 180 : 300
  const displayData = data.slice(-monthsForRange)
  const toSeries = (arr: ChartData[], key: string) => arr.map(a => typeof a[key] === 'number' ? (a[key] as number) : NaN).filter(v => !Number.isNaN(v)) as number[]
  const corrFn = useCallback((a: number[], b: number[]) => {
    const n = Math.min(a.length, b.length)
    if (n < 8) return 0
    const aa = a.slice(0, n)
    const bb = b.slice(0, n)
    const meanA = aa.reduce((x, y) => x + y, 0) / n
    const meanB = bb.reduce((x, y) => x + y, 0) / n
    const varA = aa.reduce((s, y) => s + (y - meanA) * (y - meanA), 0) / n
    const varB = bb.reduce((s, y) => s + (y - meanB) * (y - meanB), 0) / n
    const stdA = Math.sqrt(varA) || 1
    const stdB = Math.sqrt(varB) || 1
    const c = aa.reduce((sum, y, i) => sum + ((y - meanA) / stdA) * ((bb[i] - meanB) / stdB), 0) / n
    return c
  }, [])
  const describe = (ind: string, lagMonths: number, _corrVal: number) => {
    const approx = lagMonths <= 3 ? '2–3' : lagMonths === 4 ? '3–5' : '4–6'
    if (ind === 'Federal Funds Rate') return `Historically, sustained increases in the federal funds rate precede elevated credit stress by approximately ${approx} months.`
    if (ind === 'Retail Sales') return `Retail sales contractions have typically led changes in overall risk levels by ${approx} months.`
    if (ind === 'CPI (Consumer Price Index)') return `Periods of elevated inflation have historically preceded credit stress by roughly ${approx} months.`
    return `Current indicator movements suggest monitoring rather than immediate risk escalation.`
  }
  const normalizeSeries = (arr: ChartData[], keys: string[]): ChartData[] => {
    const mins: Record<string, number> = {}
    const maxs: Record<string, number> = {}
    keys.forEach(k => {
      const vals = arr.map(a => (typeof a[k] === 'number' ? (a[k] as number) : undefined)).filter(v => typeof v === 'number') as number[]
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      mins[k] = min
      maxs[k] = max
    })
    return arr.map(a => {
      const next: ChartData = { ...a }
      keys.forEach(k => {
        const v = typeof a[k] === 'number' ? (a[k] as number) : undefined
        if (v !== undefined && maxs[k] !== mins[k]) {
          next[k] = ((v - mins[k]) / (maxs[k] - mins[k])) * 100
        } else if (v !== undefined) {
          next[k] = 0
        }
      })
      return next
    })
  }
  const visibleKeys = Object.keys(seriesVisible).filter(k => seriesVisible[k])
  const normalizedData = normalizeSeries(displayData, visibleKeys)

  const yoyData = useMemo(() => {
    if (!isYoYModeActive) return []
    const dataMap = new Map<string, ChartData>()
    data.forEach(d => dataMap.set(d.date, d))

    return displayData.map(item => {
      const newItem: ChartData = { ...item }
      const parts = item.date.split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10)
        const prevYear = year - 1
        const prevDateStr = `${prevYear}-${parts[1]}-${parts[2]}`
        
        const prevItem = dataMap.get(prevDateStr)
        visibleKeys.forEach(k => {
          const currVal = typeof item[k] === 'number' ? (item[k] as number) : undefined
          const prevVal = prevItem && typeof prevItem[k] === 'number' ? (prevItem[k] as number) : undefined
          
          if (currVal !== undefined && prevVal !== undefined) {
            // Use absolute point change for Unemployment Rate and Federal Funds Rate
            // Use percentage change for CPI, Retail Sales, and Consumer Credit
            if (k === 'Unemployment Rate' || k === 'Federal Funds Rate') {
              newItem[k] = currVal - prevVal
            } else if (prevVal !== 0) {
              newItem[k] = ((currVal - prevVal) / prevVal) * 100
            } else {
              newItem[k] = undefined
            }
          } else {
            newItem[k] = undefined
          }
        })
      }
      return newItem
    })
  }, [displayData, isYoYModeActive, data, visibleKeys])

  const chartData = useMemo(() => {
    const sourceData = isYoYModeActive ? yoyData : (useNormalized ? normalizedData : displayData)
    if (!isMaVisible) return sourceData

    return sourceData.map((item, index, arr) => {
      const newItem = { ...item }
      visibleKeys.forEach(key => {
        // Calculate SMA
        // We need 'maPeriod' valid numeric values ending at 'index'
        // i.e. indices: index - maPeriod + 1 to index
        if (index < maPeriod - 1) {
          newItem[`${key}_MA`] = null
        } else {
          let sum = 0
          let count = 0
          for (let k = 0; k < maPeriod; k++) {
            const val = arr[index - k][key]
            if (typeof val === 'number') {
              sum += val
              count++
            }
          }
          if (count === maPeriod) {
            newItem[`${key}_MA`] = sum / maPeriod
          } else {
            newItem[`${key}_MA`] = null
          }
        }
      })
      return newItem
    })
  }, [isYoYModeActive, yoyData, useNormalized, normalizedData, displayData, isMaVisible, maPeriod, visibleKeys])

  const confidence = computeRiskConfidence(displayData, seriesVisible)
  const useRightAxis = !useNormalized && !isYoYModeActive && visibleKeys.length > 1
  const [hoveredLegend, setHoveredLegend] = useState<string | null>(null)
  const [axisInfoOpen, setAxisInfoOpen] = useState(false)
  const snapshotInfo = useMemo(() => {
    if (!riskTimeline.length) {
      return {
        windowLabel: 'Since last update',
        items: [] as Array<{ id: string; text: string; tooltip: string }>,
        fallback: 'Change comparison unavailable for previous update',
      }
    }
    const sorted = [...riskTimeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const current = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    if (!prev) {
      return {
        windowLabel: 'Since last update',
        items: [] as Array<{ id: string; text: string; tooltip: string }>,
        fallback: 'Change comparison unavailable for previous update',
      }
    }
    const diffMs = new Date(current.date).getTime() - new Date(prev.date).getTime()
    const diffDays = Math.max(1, Math.round(diffMs / 86400000))
    const windowLabel = `Since last update (${diffDays} days)`
    const scoreDelta = current.score - prev.score
    const rank = (level: string) => {
      if (level === 'High Risk') return 2
      if (level === 'Watch') return 1
      if (level === 'Stable') return 0
      return 0
    }
    const levelDelta = rank(current.level) - rank(prev.level)
    if (scoreDelta === 0 && levelDelta === 0) {
      return {
        windowLabel,
        items: [] as Array<{ id: string; text: string; tooltip: string }>,
        fallback: 'No material changes detected (composite risk score unchanged)',
      }
    }
    const items: Array<{ id: string; text: string; tooltip: string }> = []
    let scoreText = ''
    if (scoreDelta > 0) {
      scoreText = `Composite risk score ↑ ${scoreDelta.toFixed(1)}`
    } else if (scoreDelta < 0) {
      scoreText = `Composite risk score ↓ ${Math.abs(scoreDelta).toFixed(1)}`
    } else {
      scoreText = 'Composite risk score → unchanged'
    }
    items.push({
      id: 'score',
      text: scoreText,
      tooltip: `Previous: ${prev.score.toFixed(1)} • Current: ${current.score.toFixed(1)}`,
    })
    if (levelDelta !== 0) {
      const arrow = levelDelta > 0 ? '↑' : '↓'
      items.push({
        id: 'regime',
        text: `Risk regime ${arrow} ${prev.level} → ${current.level}`,
        tooltip: `Previous: ${prev.level} • Current: ${current.level}`,
      })
    }
    const indicatorConfigs: Array<{ key: string; label: string; unit?: string; minDelta: number }> = [
      { key: 'CPI (Consumer Price Index)', label: 'CPI', unit: '%', minDelta: 0.05 },
      { key: 'Unemployment Rate', label: 'Unemployment', unit: '%', minDelta: 0.05 },
      { key: 'Retail Sales', label: 'Retail Sales', minDelta: 0.5 },
      { key: 'Consumer Credit', label: 'Consumer Credit', minDelta: 0.5 },
    ]
    const fullData = data
    if (fullData.length >= 2 && items.length < 4) {
      const prevRow = fullData[fullData.length - 2]
      const currRow = fullData[fullData.length - 1]
      indicatorConfigs.forEach(cfg => {
        if (items.length >= 4) return
        const prevVal = typeof prevRow[cfg.key] === 'number' ? (prevRow[cfg.key] as number) : undefined
        const currVal = typeof currRow[cfg.key] === 'number' ? (currRow[cfg.key] as number) : undefined
        if (prevVal === undefined || currVal === undefined) return
        const delta = currVal - prevVal
        if (Math.abs(delta) < cfg.minDelta) return
        const arrow = delta > 0 ? '↑' : '↓'
        let text = cfg.label
        if (cfg.unit) {
          text = `${cfg.label} ${arrow} ${Math.abs(delta).toFixed(2)}${cfg.unit}`
        } else {
          text = `${cfg.label} ${arrow}`
        }
        items.push({
          id: `ind-${cfg.key}`,
          text,
          tooltip: `Previous: ${prevVal.toFixed(2)} • Current: ${currVal.toFixed(2)}`,
        })
      })
    }
    return {
      windowLabel,
      items,
      fallback: null as string | null,
    }
  }, [riskTimeline, data])
  useEffect(() => {
    try {
      const visibleLeads = ['Federal Funds Rate', 'Retail Sales', 'CPI (Consumer Price Index)'].filter(k => seriesVisible[k])
      const credit = toSeries(displayData, 'Consumer Credit')
      const candidates: Array<{ ind: string; lag: number; corr: number }> = []
      visibleLeads.forEach(ind => {
        const leadVals = toSeries(displayData, ind)
        let best = { lag: 0, corr: 0 }
        for (let L = 2; L <= 6; L++) {
          if (leadVals.length - L < 8 || credit.length < 8) continue
          const c = corrFn(leadVals.slice(0, leadVals.length - L), credit.slice(L))
          if (Math.abs(c) > Math.abs(best.corr)) best = { lag: L, corr: c }
        }
        if (best.lag > 0 && Math.abs(best.corr) >= 0.3) candidates.push({ ind, lag: best.lag, corr: best.corr })
      })
      if (!candidates.length) {
        setLagInsight('No significant lag relationship detected for the selected period.')
      } else {
        candidates.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
        const top = candidates[0]
        setLagInsight(describe(top.ind, top.lag, top.corr))
      }
    } catch {
      setLagInsight('No significant lag relationship detected for the selected period.')
    }
  }, [displayData, seriesVisible, timeRange, corrFn])

  const getLineOpacity = (key: string) => {
    if (!hoveredLegend) return 1
    return hoveredLegend === key ? 1 : 0.1
  }

  const getLineWidth = (key: string, isMa = false) => {
    if (hoveredLegend === key) return 4
    return isMa ? 2 : 3
  }

  const currentRiskData = useMemo<CurrentRiskData>(() => {
    const cpiVal = risk?.details?.inflation_rate 
       ? risk.details.inflation_rate.toFixed(2) + '%' 
       : '—'
    
    const getTrend = (key: string): 'up' | 'down' | 'neutral' => {
      if (!displayData.length) return 'neutral'
      const vals = displayData
        .map(d => d[key] as number | undefined)
        .filter((v): v is number => typeof v === 'number')
      
      if (vals.length < 2) return 'neutral'
      const curr = vals[vals.length - 1]
      const prev = vals[vals.length - 2]
      if (curr > prev) return 'up'
      if (curr < prev) return 'down'
      return 'neutral'
    }

      return {
        riskLevel: risk?.level || 'Unknown',
        updatedAt: risk?.timestamp || new Date().toISOString(),
        compositeDescription: 'Overall risk assessment',
      bulletPoints: Array.isArray(risk?.reasons) ? risk.reasons : [],
      metrics: {
        inflation: { 
          value: cpiVal, 
          trend: getTrend('CPI (Consumer Price Index)') 
        },
        unemployment: { 
          status: risk?.details?.unemployment_trend || 'Stable' 
        },
        sales: { 
          status: risk?.details?.sales_momentum || 'Neutral' 
        },
        credit: { 
          status: null 
        }
      },
      riskConfidence: (typeof confidence === 'object' && confidence.value) ? confidence.value : 'Unavailable',
      riskConfidenceTooltip: typeof confidence === 'object' ? confidence.tooltipText : '',
      lagInsight: lagInsight || '',
      historicalNote: 'Historical Pattern • Non-Predictive'
    }
  }, [risk, displayData, confidence, lagInsight])

  return (
    <>
      
      {mode === 'api_only' && (
        <div className="banner">
          Using API-only mode. Database caching is temporarily disabled.
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: '#FCA5A5', background: '#FEF2F2' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid">
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="skeleton skeleton-block" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
          <div className="card">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        </div>
      ) : (
        <>
          <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button className="info-text-btn" onClick={() => setShowMethodology(true)}>ⓘ Methodology</button>
          </div>
          <MethodologyDrawer open={showMethodology} onClose={() => setShowMethodology(false)} />
          <RiskPanel data={currentRiskData} />
          <RiskDriversPanel data={displayData} timestamp={risk?.timestamp} level={risk?.level} />
          {true && (
            <div className="card" style={{ marginTop: 8, marginBottom: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{snapshotInfo.windowLabel}</span>
                  <button
                    className="mini-btn"
                    style={{ padding: '2px 6px', fontSize: 11 }}
                    onClick={() => {
                      const next = !snapshotCollapsed
                      setSnapshotCollapsed(next)
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('snapshotCollapsed.dashboard', String(next))
                      }
                    }}
                  >
                    {snapshotCollapsed ? 'Details ▼' : 'Details ▲'}
                  </button>
                </div>
                {!snapshotCollapsed && (
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    {snapshotInfo.items.length > 0 ? (
                      snapshotInfo.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={item.tooltip}>
                          <span>•</span>
                          <span>{item.text}</span>
                        </div>
                      ))
                    ) : (
                      <div>{snapshotInfo.fallback}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="card">
            {/* Top Row: Data Series Filters */}
            <div className="chart-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <button 
                className={`risk-pill ${Object.values(seriesVisible).every(Boolean) ? 'active' : ''}`} 
                onClick={() => setSeriesVisible({
                  'CPI (Consumer Price Index)': true,
                  'Unemployment Rate': true,
                  'Federal Funds Rate': true,
                  'Retail Sales': true,
                  'Consumer Credit': true,
                })}
                onMouseEnter={() => setHoveredLegend(null)}
              >Show All</button>
              <button className={`risk-pill ${seriesVisible['CPI (Consumer Price Index)'] ? 'active' : ''}`} onClick={() => setSeriesVisible(s => ({ ...s, 'CPI (Consumer Price Index)': !s['CPI (Consumer Price Index)'] }))}>CPI</button>
              <button className={`risk-pill ${seriesVisible['Unemployment Rate'] ? 'active' : ''}`} onClick={() => setSeriesVisible(s => ({ ...s, 'Unemployment Rate': !s['Unemployment Rate'] }))}>Unemployment</button>
              <button className={`risk-pill ${seriesVisible['Federal Funds Rate'] ? 'active' : ''}`} onClick={() => setSeriesVisible(s => ({ ...s, 'Federal Funds Rate': !s['Federal Funds Rate'] }))}>Fed Rate</button>
              <button className={`risk-pill ${seriesVisible['Retail Sales'] ? 'active' : ''}`} onClick={() => setSeriesVisible(s => ({ ...s, 'Retail Sales': !s['Retail Sales'] }))}>Retail Sales</button>
              <button className={`risk-pill ${seriesVisible['Consumer Credit'] ? 'active' : ''}`} onClick={() => setSeriesVisible(s => ({ ...s, 'Consumer Credit': !s['Consumer Credit'] }))}>Consumer Credit</button>
            </div>

            {/* Bottom Row: View Modes & Navigation */}
            <div className="chart-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className={`risk-pill ${useNormalized ? 'active' : ''}`} onClick={() => {
                if (!useNormalized) setIsYoYModeActive(false)
                setUseNormalized(n => !n)
              }}>Normalized</button>
              <button className={`risk-pill ${isYoYModeActive ? 'active' : ''}`} onClick={() => {
                if (!isYoYModeActive) setUseNormalized(false)
                setIsYoYModeActive(n => !n)
              }}>YoY %</button>
              <button 
                className={`risk-pill ${showEvents ? 'active' : ''}`} 
                onClick={() => setShowEvents(s => !s)}
                title={showEvents ? "Hide Economic Events & Recessions" : "Show Economic Events & Recessions"}
              >
                 Events
               </button>
              <button 
                className={`risk-pill ${isMaVisible ? 'active' : ''}`} 
                onClick={() => _setIsMaVisible(s => !s)}
                title={isMaVisible ? "Hide Moving Average" : "Show/Hide Moving Average"}
              >
                 MA
               </button>
              {isMaVisible && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Period:</span>
                  <button className={`mini-btn ${maPeriod === 3 ? 'active' : ''}`} onClick={() => _setMaPeriod(3)}>3M</button>
                  <button className={`mini-btn ${maPeriod === 6 ? 'active' : ''}`} onClick={() => _setMaPeriod(6)}>6M</button>
                  <button className={`mini-btn ${maPeriod === 12 ? 'active' : ''}`} onClick={() => _setMaPeriod(12)}>12M</button>
                </div>
              )}
              <div className="chart-range" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className={`mini-btn ${isCompareMode ? 'active' : ''}`}
                  onClick={handleCompareToggle}
                  title={isCompareMode ? "Exit Compare Mode" : "Measure Change Between Dates"}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', fontWeight: 'bold', fontSize: '1.2em' }}
                >
                  ↔
                </button>
                <div style={{ width: 1, height: 16, background: 'var(--border-color, #e5e7eb)', margin: '0 4px' }} />
                <span className="chart-range-label">Range:</span>
                <button className={`mini-btn ${timeRange === '5Y' ? 'active' : ''}`} onClick={() => setTimeRange('5Y')}>5Y</button>
                <button className={`mini-btn ${timeRange === '15Y' ? 'active' : ''}`} onClick={() => setTimeRange('15Y')}>15Y</button>
                <button className={`mini-btn ${timeRange === '25Y' ? 'active' : ''}`} onClick={() => setTimeRange('25Y')}>25Y</button>
              </div>
            </div>
            <div className="chart-container-padded" style={{ position: 'relative' }}>
              {isCompareMode && !compareEnd && (
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  background: 'var(--color-card)',
                  color: 'var(--text-primary)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                  fontSize: 12,
                  pointerEvents: 'none'
                }}>
                  {compareStart ? "Select an end date" : "Select a start date"}
                </div>
              )}
              {isCompareMode && compareStart && compareEnd && (
                <ComparisonSummaryCard
                  startDate={compareStart}
                  endDate={compareEnd}
                  data={displayData}
                  seriesVisible={seriesVisible}
                  colors={SERIES_COLORS}
                  onClose={() => {
                    setCompareStart(null)
                    setCompareEnd(null)
                    setIsCompareMode(false)
                  }}
                />
              )}
              {!useNormalized && visibleKeys.length > 1 && (
                <div
                  onMouseEnter={() => setAxisInfoOpen(true)}
                  onMouseLeave={() => setAxisInfoOpen(false)}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    zIndex: 11,
                  }}
                >
                  <span className="muted" style={{ fontSize: 11, cursor: 'help' }}>ⓘ</span>
                  {axisInfoOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: 6,
                        background: isDark ? '#23262B' : '#ffffff',
                        border: `1px solid ${isDark ? '#2F3339' : '#e5e7eb'}`,
                        borderRadius: 6,
                        padding: '6px 8px',
                        fontSize: 12,
                        color: isDark ? '#E5E7EB' : '#111827',
                        whiteSpace: 'nowrap',
                        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    >
                      <div>This axis represents:</div>
                      <div style={{ marginTop: 4 }}>
                        <div>• Unemployment Rate</div>
                        <div>• Retail Sales</div>
                        <div>• Consumer Credit</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 10, left: 24 }} onClick={handleChartClick} style={{ cursor: isCompareMode ? 'crosshair' : 'default' }}>
                  <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'} strokeDasharray="3 3" />
                  {isYoYModeActive && <ReferenceLine y={0} stroke={isDark ? '#4B5563' : '#9CA3AF'} strokeDasharray="3 3" yAxisId="left" />}
                  <XAxis 
                    dataKey="timestamp" 
                    type="number" 
                    domain={['dataMin', 'dataMax']} 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { year: '2-digit', month: 'short' })} 
                  />
                  {(() => {
                    const labelMap: Record<string, string> = {
                      'CPI (Consumer Price Index)': 'Consumer Price Index',
                      'Unemployment Rate': 'Unemployment Rate',
                      'Federal Funds Rate': 'Federal Funds Rate',
                      'Retail Sales': 'Retail Sales',
                      'Consumer Credit': 'Consumer Credit Outstanding',
                    }
                    
                    // Dual-axis labels for YoY mode
                    const leftLabel = isYoYModeActive
                      ? 'YoY Change (%)'
                      : (useNormalized
                        ? 'Normalized Index (0–100)'
                        : (visibleKeys.length === 1
                            ? (labelMap[visibleKeys[0]] || visibleKeys[0])
                            : (isSmall ? 'CPI & Fed Funds' : 'CPI & Federal Funds Rate')))
                    
                    const rightLabel = isYoYModeActive
                      ? 'YoY Absolute Change (Points)'
                      : ''
                    
                    return (
                      <>
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 12 }}
                          domain={useNormalized ? [0, 100] as [number, number] : (isYoYModeActive ? [-25, 25] as [number, number] : [0, 'auto'])}
                          label={{
                            value: leftLabel,
                            angle: -90,
                            position: 'insideLeft',
                            offset: 18,
                            style: { fontSize: 11 },
                          }}
                        />
                        {(isYoYModeActive || (!useNormalized && !isYoYModeActive && visibleKeys.length > 1)) && (
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 12 }}
                            domain={isYoYModeActive ? [-5, 5] as [number, number] : [0, 'auto']}
                            label={isYoYModeActive ? {
                              value: rightLabel,
                              angle: -90,
                              position: 'insideRight',
                              offset: 18,
                              style: { fontSize: 11 },
                            } : undefined}
                          />
                        )}
                      </>
                    )
                  })()}
                  <Tooltip 
                    content={
                      <DashboardTooltip 
                        isDark={isDark} 
                        isYoYModeActive={isYoYModeActive} 
                        events={keyEvents}
                        showEvents={showEvents}
                        maPeriod={isMaVisible ? maPeriod : undefined}
                      />
                    }
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    content={(props: any) => {
                      const payload = (props?.payload || []).filter((item: any) => !String(item.dataKey).endsWith('_MA'))
                      return (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 4, width: '100%' }}>
                          {payload.map((item: any) => (
                            <span
                              key={item.dataKey}
                              onMouseEnter={() => setHoveredLegend(item.dataKey as string)}
                              onMouseLeave={() => setHoveredLegend(null)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 6px',
                                border: hoveredLegend === item.dataKey ? (isDark ? '1px solid #4B5563' : '1px solid var(--accent)') : '1px solid transparent',
                                background: hoveredLegend === item.dataKey ? (isDark ? '#111827' : 'rgba(0,122,255,0.12)') : 'transparent',
                                borderRadius: 6,
                                cursor: 'pointer',
                              }}
                              title={item.value || item.dataKey}
                            >
                              <span style={{ width: 10, height: 10, background: item.color, borderRadius: 2 }} />
                              <span style={{ fontSize: 12 }}>{item.value || item.dataKey}</span>
                            </span>
                          ))}
                        </div>
                      )
                    }}
                  />
                  {showEvents && recessionPeriods.map(period => (
                    <ReferenceArea
                      key={period.name}
                      x1={new Date(period.startDate).getTime()}
                      x2={new Date(period.endDate).getTime()}
                      fill="rgba(128, 128, 128, 0.2)"
                    />
                  ))}
                  {showEvents && keyEvents.map(event => (
                    <ReferenceLine
                      key={event.label}
                      x={new Date(event.date).getTime()}
                      stroke="#6B7280"
                      strokeDasharray="3 3"
                      yAxisId="left"
                    />
                  ))}
                  {seriesVisible['CPI (Consumer Price Index)'] && (
                    <Line
                      type="monotone"
                      dataKey="CPI (Consumer Price Index)"
                      yAxisId="left"
                      stroke="#F59E0B"
                      dot={false}
                      strokeOpacity={getLineOpacity('CPI (Consumer Price Index)')}
                      strokeWidth={getLineWidth('CPI (Consumer Price Index)')}
                    />
                  )}
                  {seriesVisible['Unemployment Rate'] && (
                    <Line
                      type="monotone"
                      dataKey="Unemployment Rate"
                      yAxisId={useRightAxis ? 'right' : 'left'}
                      stroke="#2563EB"
                      dot={false}
                      strokeOpacity={getLineOpacity('Unemployment Rate')}
                      strokeWidth={getLineWidth('Unemployment Rate')}
                    />
                  )}
                  {seriesVisible['Federal Funds Rate'] && (
                    <Line
                      type="stepAfter"
                      dataKey="Federal Funds Rate"
                      yAxisId={useNormalized ? 'left' : 'left'}
                      stroke="#7C3AED"
                      dot={false}
                      strokeOpacity={getLineOpacity('Federal Funds Rate')}
                      strokeWidth={getLineWidth('Federal Funds Rate')}
                    />
                  )}
                  {seriesVisible['Retail Sales'] && (
                    <Line
                      type="monotone"
                      dataKey="Retail Sales"
                      yAxisId={useRightAxis ? 'right' : 'left'}
                      stroke="#10B981"
                      dot={false}
                      strokeOpacity={getLineOpacity('Retail Sales')}
                      strokeWidth={getLineWidth('Retail Sales')}
                    />
                  )}
                  {seriesVisible['Consumer Credit'] && (
                    <Line
                      type="monotone"
                      dataKey="Consumer Credit"
                      yAxisId={useRightAxis ? 'right' : 'left'}
                      stroke="#EF4444"
                      dot={false}
                      strokeOpacity={getLineOpacity('Consumer Credit')}
                      strokeWidth={getLineWidth('Consumer Credit')}
                    />
                  )}
                  {isMaVisible && visibleKeys.map(key => {
                    const yAxisId = useNormalized ? 'left' : (['Unemployment Rate', 'Retail Sales', 'Consumer Credit'].includes(key) && useRightAxis ? 'right' : 'left')
                    return (
                      <Line
                        key={`${key}_MA`}
                        type={key === 'Federal Funds Rate' ? 'stepAfter' : 'monotone'}
                        dataKey={`${key}_MA`}
                        yAxisId={yAxisId}
                        stroke={SERIES_COLORS[key]}
                        strokeDasharray="5 5"
                        dot={false}
                        strokeOpacity={getLineOpacity(key)}
                        strokeWidth={getLineWidth(key, true)}
                        activeDot={false}
                        legendType="none"
                        connectNulls={false} // Should not draw for initial nulls
                      />
                    )
                  })}
                  {isCompareMode && compareStart && <ReferenceLine x={new Date(compareStart).getTime()} stroke="#6B7280" strokeDasharray="3 3" yAxisId="left" />}
                  {isCompareMode && compareEnd && <ReferenceLine x={new Date(compareEnd).getTime()} stroke="#6B7280" strokeDasharray="3 3" yAxisId="left" />}
                  {isCompareMode && compareStart && Object.keys(seriesVisible).filter(k => seriesVisible[k]).map(k => {
                    const d = (useNormalized ? normalizedData : displayData).find(i => i.date === compareStart)
                    if (!d || typeof d[k] !== 'number') return null
                    const yAxisId = useNormalized ? 'left' : (['Unemployment Rate', 'Retail Sales', 'Consumer Credit'].includes(k) && useRightAxis ? 'right' : 'left')
                    return <ReferenceDot key={'start-' + k} x={new Date(compareStart).getTime()} y={d[k] as number} r={4} fill={SERIES_COLORS[k]} stroke="white" yAxisId={yAxisId} />
                  })}
                  {isCompareMode && compareEnd && Object.keys(seriesVisible).filter(k => seriesVisible[k]).map(k => {
                    const d = (useNormalized ? normalizedData : displayData).find(i => i.date === compareEnd)
                    if (!d || typeof d[k] !== 'number') return null
                    const yAxisId = useNormalized ? 'left' : (['Unemployment Rate', 'Retail Sales', 'Consumer Credit'].includes(k) && useRightAxis ? 'right' : 'left')
                    return <ReferenceDot key={'end-' + k} x={new Date(compareEnd).getTime()} y={d[k] as number} r={4} fill={SERIES_COLORS[k]} stroke="white" yAxisId={yAxisId} />
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {displayData.length === 0 && (
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <h3 className="card-title">Data Tiles (Fallback)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {['Unemployment Rate', 'CPI (Consumer Price Index)', 'Federal Funds Rate', 'Retail Sales', 'Consumer Credit'].map((key) => (
                  <div key={key} className="card font-mono" style={{ padding: 16 }}>
                    <div style={{ fontSize: 15, color: '#6b7280' }}>{key}</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>—</div>
                    <div className="muted font-mono">No data</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          
        </>
      )}
    </>
  )
}
