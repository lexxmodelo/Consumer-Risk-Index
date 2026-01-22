export default function MethodologyPage() {
  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: 'span 2' }}>
        <h2 className="card-title">Consumer Risk Index — Methodology</h2>
        
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Methodology Overview</h3>
        <p className="muted">
          The Consumer Risk Index is an analytical framework designed to assess consumer financial stress using publicly available macroeconomic data. The system emphasizes observed trends, timing relationships, and relative risk levels.
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          A key feature of the index is its comparative analytics module, which contextualizes the current economic environment by quantitatively comparing it against significant historical periods. This approach is descriptive and explanatory, focusing on historical precedent rather than forecasts or outcome prediction.
        </p>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Data Sources</h3>
        <p className="muted">
          All indicators used in this project are sourced from Federal Reserve Economic Data (FRED), maintained by the Federal Reserve Bank of St. Louis. Data series are aggregated, publicly available, and reported at regular intervals.
        </p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginTop: '0.5rem' }} className="muted">
          <li>Consumer Price Index (CPI) — FRED — Monthly</li>
          <li>Consumer Credit Outstanding — FRED — Monthly</li>
          <li>Federal Funds Rate / Policy Interest Rate — FRED — As released</li>
          <li>Retail Sales — FRED — Monthly</li>
          <li>Unemployment Rate — FRED — Monthly</li>
        </ul>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Indicator Processing</h3>
        <p className="muted">
          Raw indicator values are transformed to enable consistent comparison across indicators and over time.
        </p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginTop: '0.5rem' }} className="muted">
          <li>Alignment of all series to a common monthly frequency.</li>
          <li>Handling of missing observations through carry-forward or exclusion.</li>
          <li>Normalization or standardization to ensure cross-indicator comparability and appropriate weighting.</li>
        </ul>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Risk Scoring and Classification</h3>
        <p className="muted">
          Each indicator contributes to the overall risk score based on its directional movement and magnitude, applied against a consistent weighting scheme. The total risk score is the sum of these individual contributions. Fixed thresholds are used to classify the score into Stable, Watch, and High Risk levels. These thresholds are applied uniformly across the historical series to represent relative risk conditions.
        </p>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Historical Context and Similarity Analysis</h3>
        <p className="muted">
          To provide deeper context, the framework includes a module that quantitatively measures the similarity between the current state of the risk drivers and key historical periods (e.g., 2007-2009 Financial Crisis, 2020 COVID Shock, Post-Rate-Hike Cycles).
        </p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginTop: '0.5rem' }} className="muted">
          <li><strong>Similarity Score Calculation:</strong> The similarity score (e.g., "18%") is derived from a multi-variate analysis that compares the vector of all current, normalized risk indicators against the vectors from historical periods.</li>
          <li><strong>Forward-Looking Takeaway:</strong> A qualitative summary derived from the historical period that scores the highest similarity to the present.</li>
          <li><strong>Main Contributors:</strong> Identifies the specific risk drivers that are behaving most similarly to the historical period.</li>
          <li><strong>Historical Outcomes (3M, 6M, 12M):</strong> Illustrative scenarios showing the observed evolution of the risk score in the months following the historical period most similar to today.</li>
        </ul>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Interactive Timeline Features</h3>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginTop: '0.5rem' }} className="muted">
          <li><strong>Align by Risk Score:</strong> Shifts historical comparison data so that the point where the risk score first crossed into the current risk level is aligned with the present.</li>
          <li><strong>Divergence Metric:</strong> Quantifies how much the composition of underlying risk drivers in the current period differs from the composition in the historical period.</li>
        </ul>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Lag Analysis & Risk Confidence</h3>
        <p className="muted">
          <strong>Lag Analysis:</strong> Certain indicators historically lead changes in consumer risk conditions. Lag relationships are identified through historical pattern analysis to provide contextual timing insight.
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          <strong>Risk Confidence:</strong> Reflects the reliability of the measurement based on agreement across indicator signals, trend stability, and data completeness.
        </p>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Limitations</h3>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginTop: '0.5rem' }} className="muted">
          <li>Dependence on publicly available aggregated data.</li>
          <li>Reporting and revision delays inherent to source datasets.</li>
          <li>Analysis is conducted at the macro level; individual outcomes are not evaluated.</li>
          <li>All comparative and historical outcome modules are based on historical patterns and are not forecasts of future events.</li>
        </ul>
      </div>
    </div>
  )
}
