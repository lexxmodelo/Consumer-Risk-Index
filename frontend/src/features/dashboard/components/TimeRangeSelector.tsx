type Props = {
  value: '5Y' | '15Y' | '25Y'
  onChange: (v: '5Y' | '15Y' | '25Y') => void
}

export default function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      <button className={`risk-pill ${value === '5Y' ? 'active' : ''}`} onClick={() => onChange('5Y')}>5 Years</button>
      <button className={`risk-pill ${value === '15Y' ? 'active' : ''}`} onClick={() => onChange('15Y')}>15 Years</button>
      <button className={`risk-pill ${value === '25Y' ? 'active' : ''}`} onClick={() => onChange('25Y')}>25 Years</button>
    </div>
  )
}
