import { useMemo, useState } from 'react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { ChartData } from '../../../types/chart'
import { CustomTooltip } from '../../../components/CustomTooltip'

type Driver = {
  key: string
  label: string
  weight: number
  riskDirection: 'up_increases' | 'up_decreases'
}

type Props = {
  data: ChartData[]
  timestamp?: string
  level?: string
}

const DRIVERS: Driver[] = [
  { key: 'CPI (Consumer Price Index)', label: 'Inflation (CPI)', weight: 0.30, riskDirection: 'up_increases' },
  { key: 'Unemployment Rate', label: 'Unemployment Rate', weight: 0.25, riskDirection: 'up_increases' },
  { key: 'Retail Sales', label: 'Retail Sales', weight: 0.15, riskDirection: 'up_decreases' },
  { key: 'Federal Funds Rate', label: 'Federal Funds Rate', weight: 0.20, riskDirection: 'up_increases' },
  { key: 'Consumer Credit', label: 'Consumer Credit', weight: 0.10, riskDirection: 'up_increases' },
]

function mean(arr: number[]) {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[]) {
  if (arr.length < 2) return 1
  const m = mean(arr)
  const v = mean(arr.map(x => (x - m) ** 2))
  return Math.sqrt(v) || 1
}

function zScores(values: number[]) {
  const m = mean(values)
  const s = std(values)
  return values.map(v => (v - m) / s)
}

function describeDirection(delta: number) {
  const t = 0.05
  if (delta > t) return 'increase'
  if (delta < -t) return 'decrease'
  return 'stable'
}

function classifyImpact(contribution: number): 'high' | 'medium' | 'low' {
  const a = Math.abs(contribution)
  if (a >= 0.2) return 'high'
  if (a >= 0.05) return 'medium'
  return 'low'
}

export default function RiskDriversPanel({ data, timestamp, level }: Props) {
  const isDark = typeof document !== 'undefined' && document.body.classList.contains('theme-dark')
  const [sortBy, setSortBy] = useState<'impact' | 'name' | 'score'>('impact')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const last12 = data.slice(-12)
  const byKey: Record<string, number[]> = {}
  DRIVERS.forEach(d => {
    byKey[d.key] = last12
      .map(row => (typeof row[d.key] === 'number' ? (row[d.key] as number) : undefined))
      .filter((v): v is number => typeof v === 'number')
  })

  const sparklineByKey = useMemo(() => {
    const map: Record<string, { date: string; value: number }[]> = {}
    DRIVERS.forEach(driver => {
      const series: { date: string; value: number }[] = []
      last12.forEach(row => {
        const raw = row[driver.key] as number | undefined
        if (typeof raw === 'number') {
          series.push({ date: row.date, value: raw })
        }
      })
      map[driver.key] = series.slice(-12)
    })
    return map
  }, [last12])

  const driverRows = DRIVERS.map(driver => {
    const values = byKey[driver.key] || []
    if (values.length < 6) {
      return {
        id: driver.key,
        name: driver.label,
        direction: 'stable' as const,
        impactLevel: 'low' as const,
        delta: 0,
        contribution: 0,
        text: `${driver.label} shows limited recent movement.`,
      }
    }
    const zs = zScores(values)
    const recent = zs.slice(-3)
    const prior = zs.slice(-6, -3)
    const momentum = mean(recent) - mean(prior)
    const signed = driver.riskDirection === 'up_increases' ? momentum : -momentum
    const contribution = driver.weight * signed
    const direction = describeDirection(momentum)
    const impactLevel = classifyImpact(contribution)
    const delta = Math.round(contribution * 100) / 100
    let text = ''
    if (driver.label.startsWith('Inflation')) {
      text = direction === 'increase'
        ? 'Inflation remains elevated, contributing upward pressure to risk.'
        : direction === 'decrease'
        ? 'Inflation is easing, providing stabilizing effects.'
        : 'Inflation is stable with limited recent impact on risk.'
    } else if (driver.label.startsWith('Unemployment')) {
      text = direction === 'increase'
        ? 'Unemployment is rising, adding upward pressure to risk.'
        : direction === 'decrease'
        ? 'Unemployment is declining, reducing pressure on risk.'
        : 'Unemployment levels are stable and do not materially affect risk.'
    } else if (driver.label.startsWith('Retail Sales')) {
      text = direction === 'increase'
        ? 'Retail activity is firming, offsetting risk modestly.'
        : direction === 'decrease'
        ? 'Retail activity is softening, modestly increasing risk.'
        : 'Retail activity is stable with limited impact on risk.'
    } else if (driver.label.startsWith('Federal Funds')) {
      text = direction === 'increase'
        ? 'Policy rates are tightening, adding modest upward pressure to risk.'
        : direction === 'decrease'
        ? 'Policy rates are easing, providing stabilizing effects.'
        : 'Policy stance is stable with limited recent impact.'
    } else if (driver.label.startsWith('Consumer Credit')) {
      text = direction === 'increase'
        ? 'Credit expansion contributes upward pressure to risk.'
        : direction === 'decrease'
        ? 'Credit growth is slowing, modestly stabilizing risk.'
        : 'Credit conditions are stable with limited recent impact.'
    }
    return { id: driver.key, name: driver.label, direction, impactLevel, delta, contribution, text }
  })

  const sortedDriverRows = [...driverRows].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name)
    }
    if (sortBy === 'score') {
      return b.delta - a.delta
    }
    return Math.abs(b.delta) - Math.abs(a.delta)
  })

  const maxAbsScore = Math.max(...sortedDriverRows.map(r => Math.abs(r.delta)), 0)
  const totalScore = Math.round(sortedDriverRows.reduce((sum, r) => sum + r.contribution, 0) * 100) / 100
  const lastDate = last12.length > 0 ? last12[last12.length - 1].date : undefined
  const ts = timestamp || (lastDate ? new Date(lastDate).toLocaleString() : '')
  const levelClass = (() => {
    const value = (level || '').toLowerCase()
    if (value === 'high risk') return 'risk-high'
    if (value === 'watch') return 'risk-watch'
    if (value === 'stable') return 'risk-stable'
    return ''
  })()

  const handleToggle = (id: string) => {
    setExpandedKey(prev => (prev === id ? null : id))
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <h3 className="card-title" style={{ marginBottom: 4 }}>Risk Driver Breakdown</h3>
          <div className="muted" style={{ fontSize: 12 }}>Contributions to composite risk score</div>
        </div>
        <div className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Sort by</span>
          <button
            type="button"
            className={`mini-btn ${sortBy === 'impact' ? 'active' : ''}`}
            onClick={() => setSortBy('impact')}
          >
            Impact
          </button>
          <button
            type="button"
            className={`mini-btn ${sortBy === 'score' ? 'active' : ''}`}
            onClick={() => setSortBy('score')}
          >
            Score
          </button>
          <button
            type="button"
            className={`mini-btn ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => setSortBy('name')}
          >
            Name
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {sortedDriverRows.map(row => {
          const isPositive = row.delta > 0
          const isNegative = row.delta < 0
          const barWidth = maxAbsScore > 0 ? (Math.abs(row.delta) / maxAbsScore) * 50 : 0
          const scoreColor = isPositive ? '#dc2626' : isNegative ? '#059669' : '#6b7280'
          const formattedScore = `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(2)}`
          const barLeft = isPositive ? '50%' : `${50 - barWidth}%`
          const barColor = isPositive ? '#ef4444' : isNegative ? '#10b981' : '#6b7280'
          const impactLabel = row.impactLevel === 'high' ? 'High impact' : row.impactLevel === 'medium' ? 'Medium impact' : 'Low impact'
          const spark = sparklineByKey[row.id] || []
          const sparkValues = spark.map(p => p.value)
          const sparkAvg = sparkValues.length ? mean(sparkValues) : 0
          const sparkCurrent = sparkValues.length ? sparkValues[sparkValues.length - 1] : 0
          const sparkMin = sparkValues.length ? Math.min(...sparkValues) : 0
          const sparkMax = sparkValues.length ? Math.max(...sparkValues) : 0
          const changePct = sparkAvg !== 0 ? ((sparkCurrent - sparkAvg) / Math.abs(sparkAvg)) * 100 : 0
          const absChangePct = Math.abs(changePct)
          const trendDirection =
            changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'flat'
          const lineColor = isPositive ? '#ef4444' : isNegative ? '#10b981' : '#6b7280'
          const trendText =
            trendDirection === 'up'
              ? `Up ${absChangePct.toFixed(1)}% vs 12-month average`
              : trendDirection === 'down'
              ? `Down ${absChangePct.toFixed(1)}% vs 12-month average`
              : 'Near 12-month average'

          return (
            <div
              key={row.id}
              className="driver-row"
              style={{ position: 'relative', zIndex: expandedKey === row.id ? 20 : 1 }}
              tabIndex={0}
              role="button"
              aria-expanded={expandedKey === row.id}
              aria-label={`${row.name} driver, ${impactLabel}, score ${formattedScore}, direction ${row.direction}`}
              onClick={() => handleToggle(row.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleToggle(row.id)
                }
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{row.name}</div>
                <div className="driver-description muted" style={{ marginTop: 4, fontSize: 13, fontWeight: 400, opacity: 0.85 }}>
                  {row.text}
                </div>
              </div>
              <div className="driver-bar-track" title={`Weighted contribution ${formattedScore} (${row.direction})`}>
                <div className="driver-bar-zero" />
                {barWidth > 0 && (
                  <div
                    className="driver-bar-fill"
                    style={{
                      left: barLeft,
                      width: `${barWidth}%`,
                      background: barColor,
                    }}
                  />
                )}
              </div>
              <div style={{ justifySelf: 'end', textAlign: 'right', fontSize: 13, color: scoreColor, fontWeight: 600 }}>
                <span>{formattedScore}</span>
              </div>
              {expandedKey === row.id && (
                <div className="driver-row-detail">
                  <div className="driver-expanded">
                    <div className="driver-sparkline">
                      {spark.length > 1 && (
                        <ResponsiveContainer width="100%" height={60}>
                          <LineChart data={spark}>
                            <XAxis dataKey="date" hide />
                            <ReferenceLine y={sparkAvg} stroke="#6b7280" strokeDasharray="3 3" />
                            <Tooltip
                              content={<CustomTooltip isDark={isDark} />}
                              position={{ x: 0, y: 0 }}
                              cursor={false}
                            />
                            <Line
                              type="monotone"
                              name={row.name}
                              dataKey="value"
                              stroke={lineColor}
                              strokeWidth={1.5}
                              dot={{ r: 2 }}
                              isAnimationActive
                              animationDuration={300}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="driver-expanded-meta">
                      <div className="muted" style={{ fontSize: 11 }}>
                        {trendText}
                      </div>
                      <div className="driver-expanded-metrics">
                        <span className="driver-metric">
                          <span className="driver-metric-label">Current</span>
                          <span className="driver-metric-value">
                            {sparkValues.length ? sparkCurrent.toFixed(2) : '—'}
                          </span>
                        </span>
                        <span className="driver-metric">
                          <span className="driver-metric-label">Min</span>
                          <span className="driver-metric-value">
                            {sparkValues.length ? sparkMin.toFixed(2) : '—'}
                          </span>
                        </span>
                        <span className="driver-metric">
                          <span className="driver-metric-label">Max</span>
                          <span className="driver-metric-value">
                            {sparkValues.length ? sparkMax.toFixed(2) : '—'}
                          </span>
                        </span>
                        <span className="driver-metric">
                          <span className="driver-metric-label">Average</span>
                          <span className="driver-metric-value">
                            {sparkValues.length ? sparkAvg.toFixed(2) : '—'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <hr style={{ margin: '16px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Total Risk Score</span>
            <span
              title="Legend: High Risk ≈ total score ≥ +0.20; Watch ≈ +0.05–+0.20; Stable ≈ between −0.05 and +0.05; negative scores indicate stabilizing pressure"
              style={{ fontSize: 11, cursor: 'help' }}
            >
              ⓘ
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>Sum of weighted driver contributions</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontWeight: 800,
              color: totalScore > 0 ? '#dc2626' : totalScore < 0 ? '#059669' : '#6b7280',
              fontSize: 16,
            }}
          >
            {totalScore > 0 ? `+${totalScore.toFixed(2)}` : totalScore.toFixed(2)}
          </div>
          {level && (
            <div style={{ marginTop: 4 }} className={`risk-pill ${levelClass}`}>
              {level}
            </div>
          )}
        </div>
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Last update: {ts || '—'}
      </div>
    </div>
  )
}
