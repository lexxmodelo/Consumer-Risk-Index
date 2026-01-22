type Props = {
  open: boolean
  onClose: () => void
}

export default function MethodologyDrawer({ open, onClose }: Props) {
  const overlayCls = `drawer-overlay ${open ? 'open' : ''}`
  const panelCls = `drawer-panel ${open ? 'open' : ''}`
  return (
    <>
      <div className={overlayCls} onClick={onClose} />
      <div className={panelCls} role="dialog" aria-modal="true" aria-labelledby="methodology-title">
        <div className="drawer-header">
          <div id="methodology-title" className="drawer-title">Consumer Risk Index — Methodology</div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="drawer-content">
          <section>
            <div className="drawer-section-title">Methodology Overview</div>
            <p className="drawer-muted">
              The Consumer Risk Index is an analytical framework designed to assess consumer financial stress using publicly available macroeconomic data. The system emphasizes observed trends, timing relationships, and relative risk levels.
            </p>
            <p className="drawer-muted" style={{ marginTop: 8 }}>
              A key feature of the index is its comparative analytics module, which contextualizes the current economic environment by quantitatively comparing it against significant historical periods. This approach is descriptive and explanatory, focusing on historical precedent rather than forecasts or outcome prediction.
            </p>
          </section>

          <section>
            <div className="drawer-section-title">Data Sources</div>
            <p className="drawer-muted">
              All indicators used in this project are sourced from Federal Reserve Economic Data (FRED), maintained by the Federal Reserve Bank of St. Louis. Data series are aggregated, publicly available, and reported at regular intervals.
            </p>
            <ul className="drawer-list">
              <li>Consumer Price Index (CPI) — FRED — Monthly</li>
              <li>Consumer Credit Outstanding — FRED — Monthly</li>
              <li>Federal Funds Rate / Policy Interest Rate — FRED — As released</li>
              <li>Retail Sales — FRED — Monthly</li>
              <li>Unemployment Rate — FRED — Monthly</li>
            </ul>
          </section>

          <section>
            <div className="drawer-section-title">Indicator Processing</div>
            <p className="drawer-muted">
              Raw indicator values are transformed to enable consistent comparison across indicators and over time.
            </p>
            <ul className="drawer-list">
              <li>Alignment of all series to a common monthly frequency.</li>
              <li>Handling of missing observations through carry-forward or exclusion.</li>
              <li>Normalization or standardization to ensure cross-indicator comparability and appropriate weighting.</li>
            </ul>
          </section>

          <section>
            <div className="drawer-section-title">Interactive Charting & Analytical Tools</div>
            <p className="drawer-muted">
              The dashboard includes advanced analytical tools for deeper economic trend analysis:
            </p>
            <ul className="drawer-list">
              <li>
                <strong>Year-over-Year (YoY) View:</strong> This mode transforms the data from absolute levels to its year-over-year rate of change, which is essential for identifying economic acceleration or contraction. To ensure analytical correctness, a dual-axis system is used:
                <ul className="drawer-list" style={{ marginTop: 4, marginLeft: 16 }}>
                  <li>Most indicators are shown as a percentage change (%)</li>
                  <li>Rates like the Federal Funds Rate and Unemployment Rate are shown as an absolute point change (pts), which is the standard convention for interpreting this data</li>
                </ul>
              </li>
              <li>
                <strong>Moving Average (MA) Overlay:</strong> Users can toggle a Simple Moving Average (SMA) to smooth out short-term volatility and clarify underlying trends. Selectable periods (3, 6, and 12 months) are available.
              </li>
              <li>
                <strong>Event Markers & Recession Shading:</strong> Users can overlay curated, significant macroeconomic events and official NBER-defined recession periods onto the timeline. This feature directly connects data trends to their real-world causes.
              </li>
              <li>
                <strong>Point-to-Point Comparison:</strong> An interactive mode that allows a user to select two distinct dates on the chart to instantly calculate and display the absolute and percentage change for all visible metrics over that specific period.
              </li>
            </ul>
          </section>

          <section>
            <div className="drawer-section-title">Risk Scoring and Classification</div>
            <p className="drawer-muted">
              Each indicator contributes to the overall risk score based on its directional movement and magnitude, applied against a consistent weighting scheme. The total risk score is the sum of these individual contributions. Fixed thresholds are used to classify the score into Stable, Watch, and High Risk levels. These thresholds are applied uniformly across the historical series to represent relative risk conditions.
            </p>
          </section>

          <section>
            <div className="drawer-section-title">Historical Context and Similarity Analysis</div>
            <p className="drawer-muted">
              To provide deeper context, the framework includes a module that quantitatively measures the similarity between the current state of the risk drivers and key historical periods (e.g., 2007-2009 Financial Crisis, 2020 COVID Shock, Post-Rate-Hike Cycles).
            </p>
            <ul className="drawer-list">
              <li>
                <strong>Similarity Score Calculation:</strong> The similarity score (e.g., "18%") is derived from a multi-variate analysis that compares the vector of all current, normalized risk indicators against the vectors from historical periods. A higher percentage indicates a stronger resemblance in the underlying economic configuration.
              </li>
              <li>
                <strong>Forward-Looking Takeaway:</strong> This is a qualitative summary derived from the historical period that scores the highest similarity to the present. It describes what has historically followed a similar setup, serving as a contextual guide.
              </li>
              <li>
                <strong>Main Contributors:</strong> Identifies the specific risk drivers (e.g., "Credit stress") that are behaving most similarly to the historical period, explaining the primary factors behind the high similarity score.
              </li>
              <li>
                <strong>Historical Outcomes (3M, 6M, 12M):</strong> These are not predictions. They are illustrative scenarios showing the observed evolution of the risk score in the 3, 6, and 12 months that followed the historical period most similar to today. They provide a reference for potential trajectories based on historical precedent.
              </li>
            </ul>
          </section>

          <section>
            <div className="drawer-section-title">Interactive Timeline Features</div>
            <p className="drawer-muted">
              The Risk Timeline includes advanced tools for comparative analysis:
            </p>
            <ul className="drawer-list">
              <li>
                <strong>Align by Risk Score:</strong> This toggle shifts the historical comparison data so that the point where the risk score first crossed into the current risk level is aligned with the present. This enables a more direct comparison of the events leading up to, and evolving from, similar risk states.
              </li>
              <li>
                <strong>Divergence Metric:</strong> When a comparison is active, this metric quantifies how much the composition of underlying risk drivers in the current period differs from the composition in the historical period, even if the top-level risk score is the same. "High" divergence suggests that the factors driving the risk are different this time.
              </li>
            </ul>
          </section>

          <section>
            <div className="drawer-section-title">Lag Analysis & Risk Confidence</div>
            <p className="drawer-muted">
              <strong>Lag Analysis:</strong> Certain indicators historically lead changes in consumer risk conditions. Lag relationships are identified through historical pattern analysis to provide contextual timing insight. These relationships are explanatory only and do not imply prediction.
            </p>
            <p className="drawer-muted" style={{ marginTop: 8 }}>
              <strong>Risk Confidence:</strong> This reflects the reliability of the measurement based on agreement across indicator signals, trend stability, and data completeness. Confidence indicates measurement robustness, not certainty or correctness.
            </p>
          </section>

          <section>
            <div className="drawer-section-title">Limitations</div>
            <ul className="drawer-list">
              <li>Dependence on publicly available aggregated data.</li>
              <li>Reporting and revision delays inherent to source datasets.</li>
              <li>Analysis is conducted at the macro level; individual outcomes are not evaluated.</li>
              <li>All comparative and historical outcome modules are based on historical patterns and are not forecasts of future events.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
