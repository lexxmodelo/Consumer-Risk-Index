import React from 'react'
import { TooltipProps } from 'recharts'
import { KeyEvent } from '../data/events'

interface DashboardTooltipProps extends TooltipProps<number, string> {
  isDark: boolean
  isYoYModeActive: boolean
  events: KeyEvent[]
  showEvents: boolean
  maPeriod?: number
}

export const DashboardTooltip: React.FC<DashboardTooltipProps> = ({
  active,
  payload,
  label,
  isDark,
  isYoYModeActive,
  events,
  showEvents,
  maPeriod,
}) => {
  if (!active || !payload || !payload.length || !label) {
    return null
  }

  // Find events matching the current date (Month/Year)
  const currentMonth = new Date(label).getMonth()
  const currentYear = new Date(label).getFullYear()
  
  const matchingEvents = showEvents ? events.filter(event => {
    const eventDate = new Date(event.date)
    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear
  }) : []

  const containerStyle: React.CSSProperties = {
    background: isDark ? '#23262B' : '#ffffff',
    border: `1px solid ${isDark ? '#2F3339' : '#e5e7eb'}`,
    color: isDark ? '#E5E7EB' : '#111827',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.5)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  }

  const dateStr = new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })

  return (
    <div style={containerStyle}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{dateStr}</div>
      
      {matchingEvents.length > 0 && (
        <>
          <div style={{ height: 1, background: isDark ? '#374151' : '#E5E7EB', margin: '4px 0' }} />
          {matchingEvents.map((event, idx) => (
            <div key={idx} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px' }}>🚩</span>
                <div>
                  <div style={{ fontWeight: 600, color: isDark ? '#FCA5A5' : '#DC2626' }}>EVENT:</div>
                  <div style={{ fontStyle: 'italic', lineHeight: '1.4' }}>{event.label}</div>
                </div>
              </div>
            </div>
          ))}
          <div style={{ height: 1, background: isDark ? '#374151' : '#E5E7EB', margin: '4px 0' }} />
        </>
      )}

      {payload.map((entry, index) => {
        if (!entry.name) return null
        // Skip MA lines in the main list, we append them to the parent
        if (entry.dataKey && typeof entry.dataKey === 'string' && entry.dataKey.endsWith('_MA')) {
          return null
        }

        const val = entry.value
        if (val === undefined) return null
        let formattedVal: string | number = val
        if (typeof val === 'number') {
          if (isYoYModeActive) {
            // Use absolute point change for Unemployment Rate and Federal Funds Rate
            // Use percentage change for CPI, Retail Sales, and Consumer Credit
            if (entry.name === 'Unemployment Rate' || entry.name === 'Federal Funds Rate') {
              formattedVal = (val > 0 ? '+' : '') + val.toFixed(2) + ' pts'
            } else {
              formattedVal = (val > 0 ? '+' : '') + val.toFixed(2) + '%'
            }
          } else {
            formattedVal = val.toLocaleString(undefined, { maximumFractionDigits: 3 })
          }
        }

        // Check for MA value
        let maDisplay = ''
        if (maPeriod && entry.payload && entry.dataKey) {
          const maKey = `${entry.dataKey}_MA`
          const maVal = entry.payload[maKey]
          if (typeof maVal === 'number') {
            let formattedMa = ''
             if (isYoYModeActive) {
                if (entry.name === 'Unemployment Rate' || entry.name === 'Federal Funds Rate') {
                   formattedMa = (maVal > 0 ? '+' : '') + maVal.toFixed(2) + ' pts'
                } else {
                   formattedMa = (maVal > 0 ? '+' : '') + maVal.toFixed(2) + '%'
                }
             } else {
                formattedMa = maVal.toLocaleString(undefined, { maximumFractionDigits: 3 })
             }
             maDisplay = ` (${maPeriod}M Avg: ${formattedMa})`
          }
        }
        
        return (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ width: 8, height: 8, background: entry.color, borderRadius: 2 }} />
            <span style={{ flex: 1, color: isDark ? '#D1D5DB' : '#374151' }}>{entry.name}:</span>
            <span style={{ fontWeight: 600 }}>{formattedVal}{maDisplay}</span>
          </div>
        )
      })}
    </div>
  )
}
