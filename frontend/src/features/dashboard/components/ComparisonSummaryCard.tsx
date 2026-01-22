import { ChartData } from '../../../types/chart'

interface ComparisonSummaryCardProps {
  startDate: string
  endDate: string
  data: ChartData[]
  seriesVisible: Record<string, boolean>
  onClose: () => void
  colors: Record<string, string>
}

export default function ComparisonSummaryCard({
  startDate,
  endDate,
  data,
  seriesVisible,
  onClose,
  colors,
}: ComparisonSummaryCardProps) {
  const startData = data.find((d) => d.date === startDate)
  const endData = data.find((d) => d.date === endDate)

  if (!startData || !endData) return null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  }

  const getDuration = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    const diffTime = Math.abs(e.getTime() - s.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const years = (diffDays / 365.25).toFixed(1)
    return `${years} Years`
  }

  const visibleMetrics = Object.keys(seriesVisible).filter((k) => seriesVisible[k])

  return (
    <div
      className="card"
      style={{
        position: 'absolute',
        top: 60, // Adjust as needed
        right: 24,
        zIndex: 20,
        width: 380,
        background: 'var(--color-card)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Comparison: {formatDate(startDate)} → {formatDate(endDate)}
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>
            ({getDuration(startDate, endDate)})
          </span>
        </h4>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
          aria-label="Close comparison"
        >
          &times;
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleMetrics.map((metric) => {
          const startVal = startData[metric] as number | undefined
          const endVal = endData[metric] as number | undefined

          if (startVal === undefined || endVal === undefined) {
            return (
              <div key={metric} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8 }}>
                 <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: colors[metric] || '#ccc',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{metric}</span>
                <span className="muted">N/A</span>
              </div>
            )
          }

          const diff = endVal - startVal
          const percentChange = startVal !== 0 ? (diff / startVal) * 100 : 0
          const isPositive = diff > 0
          const sign = isPositive ? '+' : ''
          const color = isPositive ? 'var(--risk-stable)' : 'var(--risk-high)'

          return (
            <div key={metric} style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: colors[metric] || '#ccc',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {metric}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 18, fontSize: '12px' }}>
                <span className="muted">
                  {startVal.toLocaleString(undefined, { maximumFractionDigits: 2 })} →{' '}
                  {endVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontWeight: 600, color }}>
                  {sign}{diff.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({sign}{percentChange.toFixed(2)}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
