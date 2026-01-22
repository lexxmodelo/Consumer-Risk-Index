import type { ChartData } from '../../../types/chart'

type Props = {
  data: ChartData[]
  seriesVisible: Record<string, boolean>
}

const INDICATORS = [
  { key: 'CPI (Consumer Price Index)', riskDirection: 'up_increases' as const },
  { key: 'Unemployment Rate', riskDirection: 'up_increases' as const },
  { key: 'Retail Sales', riskDirection: 'up_decreases' as const },
  { key: 'Federal Funds Rate', riskDirection: 'up_increases' as const },
  { key: 'Consumer Credit', riskDirection: 'up_increases' as const },
]

function mean(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
function std(arr: number[]) {
  if (arr.length < 2) return 1
  const m = mean(arr)
  const v = mean(arr.map(x => (x - m) ** 2))
  return Math.sqrt(v) || 1
}
function zScores(values: number[]) {
  if (!values.length) return []
  const m = mean(values)
  const s = std(values)
  return values.map(v => (v - m) / s)
}

export function computeRiskConfidence(data: ChartData[], seriesVisible: Record<string, boolean>) {
  const lastWindow = data.slice(-12)
  const included = INDICATORS.filter(i => seriesVisible[i.key])

  // Data completeness across last 12 months
  let totalSlots = 0
  let filledSlots = 0
  included.forEach(ind => {
    const vals = lastWindow
      .map(row => (typeof row[ind.key] === 'number' ? (row[ind.key] as number) : undefined))
      .filter((v): v is number => typeof v === 'number')
    totalSlots += lastWindow.length
    filledSlots += vals.length
  })
  const completenessRate = totalSlots > 0 ? filledSlots / totalSlots : 0

  // Indicator agreement via recent momentum direction
  const signs: number[] = []
  included.forEach(ind => {
    const vals = lastWindow
      .map(row => (typeof row[ind.key] === 'number' ? (row[ind.key] as number) : undefined))
      .filter((v): v is number => typeof v === 'number')
    if (vals.length < 6) return
    const zs = zScores(vals)
    const recent = zs.slice(-3)
    const prior = zs.slice(-6, -3)
    const momentum = mean(recent) - mean(prior)
    const signed = ind.riskDirection === 'up_increases' ? momentum : -momentum
    const t = 0.05
    const s = signed > t ? 1 : signed < -t ? -1 : 0
    if (s !== 0) signs.push(s)
  })
  let agreement = 0
  if (signs.length > 0) {
    const pos = signs.filter(s => s === 1).length
    const neg = signs.filter(s => s === -1).length
    const majority = pos >= neg ? 1 : -1
    const aligned = signs.filter(s => s === majority).length
    agreement = aligned / signs.length
  }

  // Volatility via std of z-score deltas
  const vols: number[] = []
  included.forEach(ind => {
    const vals = lastWindow
      .map(row => (typeof row[ind.key] === 'number' ? (row[ind.key] as number) : undefined))
      .filter((v): v is number => typeof v === 'number')
    if (vals.length < 8) return
    const zs = zScores(vals)
    const diffs = zs.slice(1).map((v, i) => v - zs[i])
    const recentDiffs = diffs.slice(-6)
    vols.push(std(recentDiffs))
  })
  const volIndex = vols.length ? mean(vols) : Infinity

  // Map component scores to qualitative levels
  const agreementGood = agreement >= 0.6
  const agreementOkay = agreement >= 0.4
  const volGood = volIndex <= 0.8
  const volOkay = volIndex <= 1.2
  const compGood = completenessRate >= 0.95
  const compOkay = completenessRate >= 0.8

  let value: 'High' | 'Medium' | 'Low' | 'Unavailable' = 'Unavailable'
  if (included.length === 0 || lastWindow.length < 6 || completenessRate < 0.5) {
    value = 'Unavailable'
  } else if (agreementGood && volGood && compGood) {
    value = 'High'
  } else if (agreementOkay && volOkay && compOkay) {
    value = 'Medium'
  } else {
    value = 'Low'
  }

  const tooltipText =
    value === 'Unavailable'
      ? 'Insufficient data to assess confidence.'
      : 'Confidence reflects indicator agreement, trend stability, and data completeness. Low confidence indicates higher uncertainty, not lower risk.'

  return { value, tooltipText, hasData: included.length > 0 && lastWindow.length >= 6 }
}

export default function RiskConfidenceIndicator({ data, seriesVisible }: Props) {
  const { value, tooltipText } = computeRiskConfidence(data, seriesVisible)
  const cls =
    value === 'High' ? 'confidence-pill confidence-high' :
    value === 'Medium' ? 'confidence-pill confidence-medium' :
    value === 'Low' ? 'confidence-pill confidence-low' :
    'confidence-pill'

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="confidence-container">
        <span className="confidence-label">Risk Confidence</span>
        <span title={tooltipText} aria-label="Confidence information">ⓘ</span>
      </div>
      <div className={cls} aria-live="polite">{value}</div>
    </div>
  )
}
