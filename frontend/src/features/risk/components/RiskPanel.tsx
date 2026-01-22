export interface CurrentRiskData {
  riskLevel: string
  updatedAt: string
  compositeDescription: string
  bulletPoints: string[]
  metrics: {
    inflation: { value: string; trend: 'up' | 'down' | 'neutral' }
    unemployment: { status: string }
    sales: { status: string }
    credit: { status: string | null }
  }
  riskConfidence: 'High' | 'Medium' | 'Low' | 'Unavailable'
  riskConfidenceTooltip: string
  lagInsight: string
  historicalNote: string
}

type Props = {
  data: CurrentRiskData
}

export default function RiskPanel({ data }: Props) {
  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high risk':
        return '#EF4444' // Red
      case 'watch':
        return '#F59E0B' // Yellow
      case 'stable':
        return '#10B981' // Green
      default:
        return '#6B7280' // Gray
    }
  }

  const riskColor = getRiskColor(data.riskLevel)

  return (
    <div className="current-risk-panel">
      {/* Header Section */}
      <div className="crp-header">
        <div className="crp-hero">
          <div className="crp-label">CURRENT RISK</div>
          <div className="crp-status" style={{ color: riskColor }}>
            {data.riskLevel}
          </div>
          <div className="crp-meta">
            <div>Updated: {new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="crp-subtitle">{data.compositeDescription}</div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="crp-metrics">
          <div className="crp-metrics-grid-2x2">
            <div className="crp-metric-item">
              <div className="crp-metric-label">Inflation</div>
              <div className="crp-metric-value-row">
                <span
                  className="crp-metric-value"
                  title="Year-over-year CPI inflation (vs 12 months ago)"
                >
                  {data.metrics.inflation.value}
                </span>
                {data.metrics.inflation.trend === 'up' && (
                  <span style={{ color: '#10B981', fontSize: '12px', marginLeft: 4 }}>▲</span>
                )}
                {data.metrics.inflation.trend === 'down' && (
                  <span style={{ color: '#EF4444', fontSize: '12px', marginLeft: 4 }}>▼</span>
                )}
              </div>
            </div>
            <div className="crp-metric-item">
              <div className="crp-metric-label">Unemployment</div>
              <div
                className="crp-metric-text"
                title="Unemployment status; 'Stable' means the 3-month average is within 0.5 percentage points of the prior period"
              >
                {data.metrics.unemployment.status}
              </div>
            </div>
            <div className="crp-metric-item">
              <div className="crp-metric-label">Sales</div>
              <div
                className="crp-metric-text"
                title="Retail sales momentum; 'Neutral' means the last 3 months are within about 2% of the 12-month average"
              >
                {data.metrics.sales.status}
              </div>
            </div>
            <div className="crp-metric-item">
              <div className="crp-metric-label">Credit</div>
              <div className="crp-metric-text">{data.metrics.credit.status || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="crp-divider" />

      {/* Middle Section: Key Factors & Confidence */}
      <div className="crp-middle">
        <div className="crp-factors">
          <div className="crp-section-title">Key Factors</div>
          <ul className="crp-bullets">
            {data.bulletPoints.map((bp, idx) => (
              <li key={idx}>{bp}</li>
            ))}
          </ul>
        </div>
        <div className="crp-confidence-section">
          <div className="crp-section-title-inline">
            RISK CONFIDENCE <span className="crp-info-icon" title={data.riskConfidenceTooltip}>ⓘ</span>
          </div>
          <div className="crp-conf-row">
            <span>Inflation</span>
            <span className={`crp-pill crp-pill-${data.riskConfidence.toLowerCase()}`}>
              {data.riskConfidence}
            </span>
          </div>
          <div className="crp-conf-row">
            <span>Unemployment</span>
            <span className="crp-conf-text">{data.metrics.unemployment.status}</span>
          </div>
        </div>
      </div>

      <div className="crp-divider" />

      {/* Lag Insight */}
      <div className="crp-lag">
        <div className="crp-lag-header">
          <span className="crp-lag-icon">🕒</span>
          <span className="crp-lag-title">Lag Insight</span>
        </div>
        <p className="crp-lag-text">{data.lagInsight}</p>
        <div className="crp-footer">
          {data.historicalNote}
        </div>
      </div>

      <style>{`
        .current-risk-panel {
          background: var(--color-card);
          border-radius: var(--radius-card);
          border: 1px solid var(--color-border);
          padding: 24px;
          color: var(--text-primary);
          font-family: var(--font-sans);
        }
        .crp-header {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        @media (max-width: 768px) {
          .crp-header {
            grid-template-columns: 1fr;
          }
        }
        .crp-hero {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .crp-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary, #9CA3AF);
          font-weight: 600;
        }
        .crp-status {
          font-size: 48px;
          font-weight: 700;
          line-height: 1;
        }
        .crp-meta {
          margin-top: 8px;
          font-size: 12px;
          color: var(--color-text-secondary, #9CA3AF);
        }
        .crp-subtitle {
          font-size: 12px;
          color: var(--color-text-secondary, #9CA3AF);
          margin-top: 4px;
        }
        .crp-metrics-grid-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .crp-metric-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .crp-metric-label {
          font-size: 13px;
          color: var(--color-text-secondary, #9CA3AF);
        }
        .crp-metric-value-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .crp-metric-value {
          font-size: 20px;
          font-weight: 600;
        }
        .crp-metric-text {
          font-size: 18px;
          font-weight: 500;
        }
        .crp-divider {
          height: 1px;
          background: var(--color-border, #374151);
          margin: 24px 0;
          opacity: 0.5;
        }
        .crp-middle {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 32px;
        }
        @media (max-width: 768px) {
          .crp-middle {
            grid-template-columns: 1fr;
          }
        }
        .crp-section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .crp-section-title-inline {
          font-size: 15px;
          text-transform: uppercase;
          color: var(--color-text-secondary, #9CA3AF);
          font-weight: 600;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .crp-info-icon {
          font-size: 14px;
          cursor: help;
        }
        .crp-bullets {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .crp-bullets li {
          position: relative;
          padding-left: 16px;
          font-size: 14px;
          line-height: 1.5;
        }
        .crp-bullets li::before {
          content: "•";
          position: absolute;
          left: 0;
          color: #10B981; /* Green bullet */
          font-weight: bold;
        }
        .crp-confidence-section {
          background: rgba(205, 205, 205, 0.14);
          border-radius: 8px;
          padding: 16px;
        }
        .crp-conf-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 12px;
        }
        .crp-conf-row:last-child {
          margin-bottom: 0;
        }
        .crp-pill {
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          color: #111827;
        }
        .crp-pill-high { background: #A7F3D0; color: #064E3B; }
        .crp-pill-medium { background: #FDE68A; color: #78350F; }
        .crp-pill-low { background: #FECACA; color: #7F1D1D; }
        .crp-pill-unavailable { background: #E5E7EB; color: #374151; }
        
        .crp-lag-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .crp-lag-title {
          font-weight: 600;
          font-size: 15px;
        }
        .crp-lag-text {
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 12px;
          color: var(--color-text-secondary, #D1D5DB);
        }
        .crp-footer {
          font-size: 11px;
          color: var(--color-text-secondary, #6B7280);
          text-align: right;
          background: rgba(0,0,0,0.2);
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          float: right;
        }
        @media (max-width: 1024px) {
          .crp-confidence-section {
            padding: 14px;
          }
          .crp-conf-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            font-size: 13px;
          }
          .crp-pill {
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  )
}
