import { useEffect, useMemo, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, ReferenceLine, ReferenceDot } from 'recharts'
import { getRiskTimeline } from '../../../lib/api'

type MacroEventCategory =
  | 'Monetary Policy'
  | 'Inflation'
  | 'Labor Market'
  | 'Consumer/Credit Stress'
  | 'Recession'

interface MacroEvent {
  date: string
  category: MacroEventCategory
  short_label: string
  description: string
}

const getEventColor = (category: MacroEventCategory, isDark: boolean) => {
  if (category === 'Monetary Policy') return isDark ? '#F97316' : '#C2410C'
  if (category === 'Inflation') return isDark ? '#FDE047' : '#CA8A04'
  if (category === 'Labor Market') return isDark ? '#22C55E' : '#16A34A'
  if (category === 'Consumer/Credit Stress') return isDark ? '#A855F7' : '#7C3AED'
  return isDark ? '#F97373' : '#DC2626'
}

const MACRO_EVENTS: ReadonlyArray<MacroEvent> = [
  {
    date: '2001-01',
    category: 'Monetary Policy',
    short_label: 'Fed starts 2001 easing cycle',
    description: 'The Federal Reserve began a series of federal funds rate cuts early in 2001.',
  },
  {
    date: '2004-06',
    category: 'Monetary Policy',
    short_label: 'Fed starts 2004 tightening cycle',
    description: 'The Federal Reserve raised the federal funds rate for the first time in its 2004–2006 tightening cycle.',
  },
  {
    date: '2007-09',
    category: 'Monetary Policy',
    short_label: 'Fed cuts rates amid turmoil',
    description: 'The Federal Reserve reduced the federal funds rate as financial market stress intensified in 2007.',
  },
  {
    date: '2008-01',
    category: 'Monetary Policy',
    short_label: 'Emergency 75bp intermeeting rate cut',
    description: 'The Federal Reserve approved a large intermeeting reduction in the federal funds rate target in January 2008.',
  },
  {
    date: '2015-12',
    category: 'Monetary Policy',
    short_label: 'First hike after zero rate period',
    description: 'The Federal Reserve raised the target range for the federal funds rate for the first time since the financial crisis.',
  },
  {
    date: '2019-07',
    category: 'Monetary Policy',
    short_label: 'Fed cuts after 2015–2018 hikes',
    description: 'The Federal Reserve lowered the federal funds rate following its earlier gradual increases.',
  },
  {
    date: '2020-03',
    category: 'Monetary Policy',
    short_label: 'Fed cuts to near zero',
    description: 'The Federal Reserve reduced the target range for the federal funds rate to near zero in March 2020.',
  },
  {
    date: '2022-03',
    category: 'Monetary Policy',
    short_label: 'Fed begins 2022 hiking cycle',
    description: 'The Federal Reserve raised the federal funds rate for the first time in its 2022 tightening cycle.',
  },
  {
    date: '2022-06',
    category: 'Monetary Policy',
    short_label: 'First 75bp hike since 1994',
    description: 'The Federal Reserve implemented a 75-basis-point increase in the federal funds rate in June 2022.',
  },
  {
    date: '2008-07',
    category: 'Inflation',
    short_label: 'CPI peaks before financial crisis',
    description: 'Headline CPI year-over-year inflation reached a high level in mid-2008 before declining during the financial crisis.',
  },
  {
    date: '2021-06',
    category: 'Inflation',
    short_label: 'CPI rises above five percent',
    description: 'Headline CPI year-over-year inflation moved above five percent for the first time in many years.',
  },
  {
    date: '2021-10',
    category: 'Inflation',
    short_label: 'CPI exceeds six percent year-over-year',
    description: 'Headline CPI year-over-year inflation climbed above six percent in late 2021.',
  },
  {
    date: '2022-06',
    category: 'Inflation',
    short_label: 'CPI reaches recent nine percent peak',
    description: 'Headline CPI year-over-year inflation reached around nine percent in June 2022.',
  },
  {
    date: '2022-07',
    category: 'Inflation',
    short_label: 'CPI declines from June 2022 peak',
    description: 'Headline CPI year-over-year inflation eased from its June 2022 level in subsequent months.',
  },
  {
    date: '2023-06',
    category: 'Inflation',
    short_label: 'CPI slows toward three percent',
    description: 'Headline CPI year-over-year inflation moved closer to the mid-single-digit range by mid-2023.',
  },
  {
    date: '2003-06',
    category: 'Labor Market',
    short_label: 'Unemployment peaks early 2000s downturn',
    description: 'The U.S. unemployment rate reached an elevated level following the early‑2000s slowdown.',
  },
  {
    date: '2009-10',
    category: 'Labor Market',
    short_label: 'Unemployment peaks during Great Recession',
    description: 'The U.S. unemployment rate rose to around ten percent in late 2009.',
  },
  {
    date: '2019-02',
    category: 'Labor Market',
    short_label: 'Unemployment reaches multi-decade low',
    description: 'The U.S. unemployment rate remained near multi-decade lows before the COVID‑19 pandemic.',
  },
  {
    date: '2020-04',
    category: 'Labor Market',
    short_label: 'Unemployment spikes during COVID shutdowns',
    description: 'The U.S. unemployment rate rose sharply in April 2020 as activity contracted.',
  },
  {
    date: '2022-07',
    category: 'Labor Market',
    short_label: 'Unemployment returns to pre-COVID lows',
    description: 'The U.S. unemployment rate moved back near its pre‑pandemic low by mid‑2022.',
  },
  {
    date: '2008-09',
    category: 'Consumer/Credit Stress',
    short_label: 'Retail sales fall during 2008 crisis',
    description: 'Measures of U.S. retail and food services sales declined notably in late 2008.',
  },
  {
    date: '2008-10',
    category: 'Consumer/Credit Stress',
    short_label: 'Revolving credit begins sustained contraction',
    description: 'Revolving consumer credit outstanding began a period of contraction around late 2008.',
  },
  {
    date: '2020-04',
    category: 'Consumer/Credit Stress',
    short_label: 'Retail sales plunge in April 2020',
    description: 'U.S. retail and food services sales recorded a sharp monthly decline in April 2020.',
  },
  {
    date: '2020-05',
    category: 'Consumer/Credit Stress',
    short_label: 'Consumer credit outstanding falls sharply',
    description: 'Consumer credit outstanding posted a large decline in the early months of the COVID‑19 pandemic.',
  },
  {
    date: '2001-03',
    category: 'Recession',
    short_label: '2001 recession officially begins',
    description: 'The U.S. business cycle peak dated to March 2001 marks the start of the 2001 recession according to the NBER.',
  },
  {
    date: '2007-12',
    category: 'Recession',
    short_label: '2007 recession officially begins',
    description: 'The U.S. business cycle peak dated to December 2007 marks the start of the Great Recession according to the NBER.',
  },
  {
    date: '2020-02',
    category: 'Recession',
    short_label: '2020 recession officially begins',
    description: 'The U.S. business cycle peak dated to February 2020 marks the start of the COVID‑19 recession according to the NBER.',
  },
]

// Define constants for clarity and easy maintenance
const CHART_HEIGHT_PX = 265;
const Y_AXIS_RANGE = 6;

// Helper function to calculate the pixel position
const getLabelPosition = (midpointValue: number) => {
  // Calculate the position as a ratio (0.0 to 1.0)
  const positionRatio = midpointValue / Y_AXIS_RANGE;
  // Convert ratio to pixels, inverting for the top-down CSS coordinate system
  return (1 - positionRatio) * CHART_HEIGHT_PX;
};

const InfoTooltip = ({ text, isDark }: { text: string; isDark: boolean }) => {
  const [show, setShow] = useState(false);

  return (
    <div 
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{ cursor: 'help', opacity: 0.6 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {show && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 8,
          padding: '8px 12px',
          borderRadius: 6,
          backgroundColor: isDark ? '#374151' : '#1F2937',
          color: '#F9FAFB',
          fontSize: 12,
          fontWeight: 400,
          width: 240,
          textAlign: 'center',
          lineHeight: 1.4,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 50,
          pointerEvents: 'none'
        }}>
          {text}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            marginLeft: -4,
            borderWidth: 4,
            borderStyle: 'solid',
            borderColor: `${isDark ? '#374151' : '#1F2937'} transparent transparent transparent`
          }} />
        </div>
      )}
    </div>
  );
};

export default function RiskTimelinePage() {
  const [timeline, setTimeline] = useState<{date: string; level: string; score: number}[]>([])

  const [comparison, setComparison] = useState<'None' | '2007–2009 Financial Crisis' | '2020 COVID Shock' | 'Post-Rate-Hike Cycles'>('None')
  const [error, setError] = useState<string | null>(null)
  // Cache status removed from UI
  const isDark = typeof document !== 'undefined' && document.body.classList.contains('theme-dark')
  const [showEvents, setShowEvents] = useState(true)
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 })
  const [_viewHistory, setViewHistory] = useState<{ start: number; end: number }[]>([])
  const [dragSelection, setDragSelection] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })

  const [cursorDate, setCursorDate] = useState<string | null>(null)
  const [zoomError, setZoomError] = useState<string | null>(null)
  const [macroError, setMacroError] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [snapshotCollapsed, setSnapshotCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const val = localStorage.getItem('snapshotCollapsed.timeline')
    return val === 'true'
  })
  const [snapshotHidden, _setSnapshotHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const val = localStorage.getItem('snapshotHidden.timeline')
    return val === 'true'
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const tl = await getRiskTimeline()
        setTimeline(tl || [])
        setError(null)
      } catch (err) {
        console.error('Error loading timeline:', err)
        setError('Failed to load timeline.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const PERIODS: Record<string, { start: string; end: string; source: string }> = {
    '2007–2009 Financial Crisis': { start: '2007-12-01', end: '2009-06-01', source: 'Global financial crisis period' },
    '2020 COVID Shock': { start: '2020-03-01', end: '2020-09-01', source: 'COVID-19 onset and acute shock' },
    'Post-Rate-Hike Cycles': { start: '2022-03-01', end: '2023-12-01', source: 'Fed tightening cycle' },
  }

  const SIMILARITY_DATA: Record<string, any> = {
    '2007–2009 Financial Crisis': {
      score: '18%',
      drivers: ['Credit stress', 'Housing collapse', 'Liquidity crisis'],
      takeaway: 'Current configuration historically precedes stabilization phases, not crisis escalation.',
      outcomes: { '3m': 'Severe Deterioration', '6m': 'Crisis Peak', '12m': 'Slow Recovery' },
      stats: {
        inflation: 'Lower',
        creditStress: 'Much lower',
        marketVol: 'Lower',
        policy: 'Tighter',
      },
      divergence: 'High',
      divergenceVal: 82,
    },
    '2020 COVID Shock': {
      score: '24%',
      drivers: ['External shock', 'Lockdowns', 'Fiscal stimulus'],
      takeaway: 'Pattern resembles mid-cycle slowdowns more than pre-crisis stress.',
      outcomes: { '3m': 'Sharp Drop', '6m': 'V-Shape Recovery', '12m': 'Expansion' },
      stats: {
        inflation: 'Higher',
        creditStress: 'Similar',
        marketVol: 'Higher',
        policy: 'Looser',
      },
      divergence: 'High',
      divergenceVal: 76,
    },
    'Post-Rate-Hike Cycles': {
      score: '41%',
      drivers: ['Credit growth deceleration', 'Stable inflation trend', 'Neutral liquidity conditions'],
      takeaway: 'Current trajectory is tracking closest to post-rate-hike slowdowns, not systemic crisis patterns.',
      outcomes: { '3m': 'Stabilization', '6m': 'Gradual Improvement', '12m': 'Normal Growth' },
      stats: {
        inflation: 'Similar',
        creditStress: 'Higher',
        marketVol: 'Similar',
        policy: 'Similar',
      },
      divergence: 'Low',
      divergenceVal: 59,
    },
  }

  const [showHistoricalOutcomes, setShowHistoricalOutcomes] = useState(false)
  const [alignByRiskScore, setAlignByRiskScore] = useState(false)

  const selected = comparison !== 'None' ? PERIODS[comparison] : undefined

  // Removed unused monthlySeries, zScores, momentumDelta, trendSign, indicatorAlignment logic


  // Cache label removed

  const snapshotInfo = useMemo(() => {
    if (!timeline.length) {
      return {
        windowLabel: 'Since last update',
        items: [] as Array<{ id: string; text: string; tooltip: string }>,
        fallback: 'Change comparison unavailable for previous update',
      }
    }
    const sorted = [...timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
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
        id: 'level',
        text: `Risk level ${arrow} ${prev.level} → ${current.level}`,
        tooltip: `Previous: ${prev.level} • Current: ${current.level}`,
      })
    }
    return {
      windowLabel,
      items,
      fallback: null as string | null,
    }
  }, [timeline])

  const REGIME_THRESHOLDS = { stableMax: 1.99, watchMax: 3.99 }

  const transitions = useMemo(() => {
    const res: Array<{ date: string; toLevel: string }> = []
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1]
      const curr = timeline[i]
      if (prev.level !== curr.level) {
        res.push({ date: curr.date, toLevel: curr.level })
      }
    }
    return res
  }, [timeline])

  const dateIndexMap = useMemo(() => {
    const map: Record<string, number> = {}
    timeline.forEach((p, idx) => {
      map[p.date] = idx
    })
    return map
  }, [timeline])

  const transitionsByDate = useMemo(() => {
    const map: Record<string, string[]> = {}
    transitions.forEach(t => {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(`Transition to ${t.toLevel}`)
    })
    return map
  }, [transitions])

  useEffect(() => {
    if (timeline.length) {
      setViewRange({ start: 0, end: timeline.length - 1 })
      setViewHistory([])
    }
  }, [timeline])

  const eventsByDate = useMemo(() => {
    try {
      const map: Record<string, MacroEvent[]> = {}
      if (!timeline.length) return map
      const monthToDates: Record<string, string[]> = {}
      timeline.forEach(p => {
        const month = p.date.slice(0, 7)
        if (!monthToDates[month]) monthToDates[month] = []
        monthToDates[month].push(p.date)
      })
      MACRO_EVENTS.forEach(e => {
        const month = e.date
        const candidates = monthToDates[month]
        const dateKey = candidates && candidates.length ? candidates[0] : `${month}-01`
        if (!map[dateKey]) map[dateKey] = []
        map[dateKey].push(e)
      })
      setMacroError(false)
      return map
    } catch (e) {
      console.error('Failed to process macro events:', e)
      setMacroError(true)
      return {}
    }
  }, [timeline])

  const visibleTimeline = useMemo(() => {
    if (!timeline.length) return [] as { date: string; level: string; score: number }[]
    const start = Math.max(0, Math.min(viewRange.start, timeline.length - 1))
    const end = Math.max(start, Math.min(viewRange.end, timeline.length - 1))
    return timeline.slice(start, end + 1)
  }, [timeline, viewRange])

  const labeledTransitionDates = useMemo(() => {
    if (!visibleTimeline.length || !transitions.length) return new Set<string>()
    const startDate = visibleTimeline[0].date
    const endDate = visibleTimeline[visibleTimeline.length - 1].date
    const visible = transitions.filter(t => t.date >= startDate && t.date <= endDate)
    const minDistance = Math.max(1, Math.floor(visibleTimeline.length / 6))
    const result = new Set<string>()
    let lastIdx: number | null = null
    visible.forEach(t => {
      const idx = dateIndexMap[t.date]
      if (idx === undefined) return
      if (lastIdx === null || idx - lastIdx >= minDistance) {
        result.add(t.date)
        lastIdx = idx
      }
    })
    return result
  }, [visibleTimeline, transitions, dateIndexMap])

  const visibleEventDates = useMemo(() => {
    if (!visibleTimeline.length) return [] as string[]
    const startDate = visibleTimeline[0].date
    const endDate = visibleTimeline[visibleTimeline.length - 1].date
    return Object.keys(eventsByDate).filter(d => d >= startDate && d <= endDate)
  }, [visibleTimeline, eventsByDate])

  const hasEventsInRange = visibleEventDates.length > 0

  const latestPoint = useMemo(() => {
    if (!timeline.length) return null as { date: string; level: string; score: number } | null
    return timeline[timeline.length - 1]
  }, [timeline])

  const renderTooltip = useCallback(
    (props: any) => {
      const { active, label, payload } = props
      if (!active || !label) return null
      const base = new Date(label as string).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
      const events = showEvents ? eventsByDate[label as string] || [] : []
      const transitionLabels = transitionsByDate[label as string] || []
      return (
        <div
          style={{
            background: isDark ? '#23262B' : '#ffffff',
            border: `1px solid ${isDark ? '#2F3339' : '#e5e7eb'}`,
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 12,
            color: isDark ? '#E5E7EB' : '#111827',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{base}</div>
          {payload &&
            payload.map((item: any) => (
              <div key={item.dataKey} style={{ marginBottom: events.length ? 2 : 0 }}>
                {item.name || 'Risk score'}: {item.value}
              </div>
            ))}
          {events.length > 0 &&
            events.map((e, idx) => (
              <div key={`${label}-${idx}`} style={{ marginTop: idx === 0 ? 4 : 2 }}>
                <div style={{ fontWeight: 600 }}>{e.short_label}</div>
                <div style={{ opacity: 0.85 }}>{e.description}</div>
              </div>
            ))}
          {transitionLabels.length > 0 &&
            transitionLabels.map((txt, idx) => (
              <div key={`transition-${label}-${idx}`} style={{ marginTop: idx === 0 && events.length === 0 ? 4 : 2, opacity: 0.9 }}>
                {txt}
              </div>
            ))}
        </div>
      )
    },
    [eventsByDate, isDark, showEvents, transitionsByDate]
  )

  // Removed renderWithClickableComparison helper

  const handleChartClick = (e: any) => {
    if (!e) return
    const rawLabel =
      (e.activeLabel as string | undefined) ||
      (e.activePayload &&
        e.activePayload[0] &&
        e.activePayload[0].payload &&
        (e.activePayload[0].payload.date as string | undefined))
    if (!rawLabel) return
    const label = rawLabel
    if (!timeline.length) return

    if (!dragSelection.start) {
      setDragSelection({ start: label, end: null })
      setCursorDate(label)
      setZoomError(null)
      return
    }

    const startLabel = dragSelection.start
    if (startLabel === label) return
    const startIdx = dateIndexMap[startLabel]
    const endIdx = dateIndexMap[label]
    if (startIdx === undefined || endIdx === undefined) {
      setDragSelection({ start: null, end: null })
      setCursorDate(null)
      return
    }
    const s = Math.min(startIdx, endIdx)
    const eIdx = Math.max(startIdx, endIdx)
    if (eIdx - s < 3) {
      setZoomError('Select a wider range to zoom.')
      setTimeout(() => setZoomError(null), 1500)
      return
    }

    setViewHistory(prev => {
      if (!timeline.length) return prev
      const baseStart = Math.max(0, viewRange.start)
      const baseEnd =
        viewRange.start === 0 && viewRange.end === 0
          ? timeline.length - 1
          : Math.min(timeline.length - 1, Math.max(viewRange.end, baseStart))
      return [...prev, { start: baseStart, end: baseEnd }]
    })
    setViewRange({ start: s, end: eIdx })
    setDragSelection({ start: null, end: null })
    setCursorDate(null)
    setZoomError(null)
  }

  const handleChartMouseMove = (e: any) => {
    if (!e || !e.activeLabel) return
    setCursorDate(e.activeLabel)
  }

  const clearSelection = () => {
    setDragSelection({ start: null, end: null })
    setCursorDate(null)
    setZoomError(null)
  }

  const handleZoomOut = () => {
    if (!timeline.length) return
    setViewHistory(prev => {
      if (!prev.length) {
        setViewRange({ start: 0, end: timeline.length - 1 })
        return prev
      }
      const next = [...prev]
      const last = next.pop()
      if (last) {
        setViewRange(last)
      }
      return next
    })
    clearSelection()
  }

  const handleResetZoom = () => {
    if (!timeline.length) return
    setViewRange({ start: 0, end: timeline.length - 1 })
    setViewHistory([])
    clearSelection()
  }

  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 160px)' }}>
        <h3 className="card-title">
          Risk Timeline
          <span
            title="This timeline allows you to analyze historical risk scores and compare them against major economic events."
            style={{ fontSize: 12, marginLeft: 6, cursor: 'help' }}
          >
            ⓘ
          </span>
        </h3>
        <div style={{ marginBottom: 8 }}>
        </div>
        {loading ? (
          <div className="card" style={{ marginBottom: 8, padding: '8px 12px' }}>
            <div className="skeleton skeleton-block" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : (
        <>
        {!snapshotHidden && (
          <div className="card" style={{ marginBottom: 24, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
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
                      localStorage.setItem('snapshotCollapsed.timeline', String(next))
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
        <div className="chart-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <span className="chart-range-label">Compare With:</span>
          {(['None', '2007–2009 Financial Crisis', '2020 COVID Shock', 'Post-Rate-Hike Cycles'] as const).map(opt => (
            <button key={opt} className={`mini-btn ${comparison === opt ? 'active' : ''}`} onClick={() => setComparison(opt)}>
              {opt}
            </button>
          ))}
          {comparison !== 'None' && (
             <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 12, cursor: 'pointer' }}>
               <input
                 type="checkbox"
                 checked={alignByRiskScore}
                 onChange={e => setAlignByRiskScore(e.target.checked)}
               />
               Align by risk score
             </label>
          )}
          <button
            className={`mini-btn ${showEvents ? 'active' : ''}`}
            onClick={() => setShowEvents(v => !v)}
          >
            Macro Events
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {zoomError && (
              <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
                {zoomError}
              </span>
            )}
            {macroError && showEvents && (
              <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>
                Warning: Macro events failed to load
              </span>
            )}
            <button className="mini-btn" onClick={handleZoomOut}>Zoom Out</button>
            <button className="mini-btn" onClick={handleResetZoom}>Reset View</button>
            <span className="muted" style={{ fontSize: 11 }} title="Click once to set zoom start, then again to zoom.">ⓘ</span>
          </div>
        </div>

        {comparison !== 'None' && SIMILARITY_DATA[comparison] && (
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '8px 12px',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 12,
            flexWrap: 'wrap'
          }}>
            <div style={{ fontWeight: 600, marginRight: 8 }}>
              Compared to {comparison} at same risk level:
            </div>
            {Object.entries(SIMILARITY_DATA[comparison].stats).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', gap: 4 }}>
                <span style={{ opacity: 0.7 }}>{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span style={{ fontWeight: 500 }}>{val as string}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Divergence:</span>
              <div style={{ width: 60, height: 6, background: 'rgba(128,128,128,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                 <div style={{
                   width: `${SIMILARITY_DATA[comparison].divergenceVal}%`,
                   height: '100%',
                   background: SIMILARITY_DATA[comparison].divergence === 'High' ? '#EF4444' : '#10B981'
                 }} />
              </div>
              <span style={{ fontSize: 11 }}>{SIMILARITY_DATA[comparison].divergence}</span>
            </div>
          </div>
        )}
        <div className="chart-container" style={{ position: 'relative', marginBottom: 8, flex: 1, minHeight: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={visibleTimeline}
              margin={{ top: 20, right: 28, left: 0, bottom: 20 }}
              onClick={handleChartClick}
              onMouseMove={handleChartMouseMove}
            >
              <ReferenceArea
                y1={0}
                y2={REGIME_THRESHOLDS.stableMax}
                fill={isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.12)'}
                stroke="none"
              />
              <ReferenceArea
                y1={REGIME_THRESHOLDS.stableMax}
                y2={REGIME_THRESHOLDS.watchMax}
                fill={isDark ? 'rgba(234,179,8,0.18)' : 'rgba(234,179,8,0.1)'}
                stroke="none"
              />
              <ReferenceArea
                y1={REGIME_THRESHOLDS.watchMax}
                y2={6}
                fill={isDark ? 'rgba(248,113,113,0.2)' : 'rgba(248,113,113,0.12)'}
                stroke="none"
              />
              <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'} strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                interval="preserveStartEnd"
                tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                tick={{ fontSize: 11 }}
              />
              <YAxis domain={[0, 6]} />
              <Tooltip content={renderTooltip} cursor={{ stroke: isDark ? '#4B5563' : '#9CA3AF', strokeDasharray: '3 3' }} />
              <Legend />
              <ReferenceLine y={REGIME_THRESHOLDS.stableMax} stroke={isDark ? '#4B5563' : '#D1D5DB'} strokeDasharray="3 3" />
              <ReferenceLine y={REGIME_THRESHOLDS.watchMax} stroke={isDark ? '#4B5563' : '#D1D5DB'} strokeDasharray="3 3" />
              {selected && (
                <ReferenceArea 
                  x1={selected.start} 
                  x2={selected.end} 
                  fill={isDark ? 'rgba(148,163,184,0.18)' : 'rgba(107,114,128,0.15)'} 
                  stroke={isDark ? 'rgba(148,163,184,0.35)' : 'rgba(107,114,128,0.35)'} 
                  fillOpacity={0.25}
                />
              )}
              {selected && (
                <>
                  <ReferenceLine
                    x={selected.start}
                    stroke={isDark ? 'rgba(16,185,129,0.75)' : 'rgba(16,185,129,0.85)'}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                  <ReferenceLine
                    x={selected.end}
                    stroke={isDark ? 'rgba(16,185,129,0.75)' : 'rgba(16,185,129,0.85)'}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                </>
              )}
              {dragSelection.start && cursorDate && (
                <ReferenceArea
                  x1={dragSelection.start}
                  x2={cursorDate}
                  fill={isDark ? 'rgba(59,130,246,0.24)' : 'rgba(59,130,246,0.18)'}
                  stroke={isDark ? '#3B82F6' : '#2563EB'}
                  strokeOpacity={0.9}
                  strokeDasharray="4 2"
                  className={zoomError ? 'selection-error' : ''}
                />
              )}
              {dragSelection.start && !dragSelection.end && (
                <>
                  <ReferenceLine
                    x={dragSelection.start}
                    stroke={isDark ? '#3B82F6' : '#2563EB'}
                    strokeWidth={1}
                    strokeDasharray="4 2"
                  />
                  <ReferenceDot
                    x={dragSelection.start}
                    y={0}
                    r={6}
                    fill={isDark ? '#3B82F6' : '#2563EB'}
                    stroke="none"
                    shape={(props: any) => (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={props.r}
                        fill={props.fill}
                        className="zoom-anchor-handle"
                      />
                    )}
                  />
                </>
              )}
              {transitions.map(t => {
                const isLabeled = labeledTransitionDates.has(t.date)
                return (
                  <ReferenceLine
                    key={`transition-${t.date}`}
                    x={t.date}
                    stroke={isDark ? '#9CA3AF' : '#9CA3AF'}
                    strokeDasharray="4 4"
                    label={isLabeled ? { position: 'top', value: `To ${t.toLevel}` } : undefined}
                  />
                )
              })}
              {latestPoint && (
                <ReferenceLine
                  x={latestPoint.date}
                  stroke={isDark ? '#F97316' : '#EA580C'}
                  strokeDasharray="2 2"
                  label={{ position: 'top', value: 'Current', fill: isDark ? '#F97316' : '#EA580C' }}
                />
              )}
              {latestPoint && (
                <ReferenceDot
                  x={latestPoint.date}
                  y={latestPoint.score}
                  r={4}
                  fill={isDark ? '#F97316' : '#EA580C'}
                  stroke="none"
                />
              )}
              <Line type="monotone" dataKey="score" name="Risk Score" stroke="#38BDF8" dot={false} strokeWidth={2} />
              {showEvents &&
                hasEventsInRange &&
                visibleEventDates.flatMap(date => {
                  const events = eventsByDate[date] || []
                  const baseY = 5.8
                  const step = 0.35
                  const lineEl = (
                    <ReferenceLine
                      key={`event-line-${date}`}
                      x={date}
                      stroke={isDark ? '#6366F1' : '#4F46E5'}
                      strokeWidth={1}
                      strokeDasharray="4 2"
                    />
                  )
                  const dots = events.map((e, idx) => {
                    const y = baseY - idx * step
                    return (
                      <ReferenceDot
                        key={`event-dot-${date}-${idx}`}
                        x={date}
                        y={y}
                        r={3.5}
                        fill={getEventColor(e.category, isDark)}
                        stroke={isDark ? '#020617' : '#ffffff'}
                        strokeWidth={1}
                      />
                    )
                  })
                  return [lineEl, ...dots]
                })}
            </LineChart>
          </ResponsiveContainer>
          <div
            style={{
              position: 'absolute',
              left: 1,
              top: `${getLabelPosition(REGIME_THRESHOLDS.stableMax / 2)}px`,
              transform: 'translateY(-50%)',
              fontSize: 10,
              fontWeight: 600,
              color: isDark ? '#A3E635' : '#4D7C0F',
              pointerEvents: 'none',
            }}
          >
            Stable Level
          </div>
          <div
            style={{
              position: 'absolute',
              left: 1,
              top: `${getLabelPosition((REGIME_THRESHOLDS.stableMax + REGIME_THRESHOLDS.watchMax) / 2)}px`,
              transform: 'translateY(-50%)',
              fontSize: 10,
              fontWeight: 600,
              color: isDark ? '#FBBF24' : '#92400E',
              pointerEvents: 'none',
            }}
          >
            Watch Level
          </div>
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: `${getLabelPosition((REGIME_THRESHOLDS.watchMax + Y_AXIS_RANGE) / 2)}px`,
              transform: 'translateY(-50%)',
              fontSize: 10,
              fontWeight: 600,
              color: isDark ? '#FCA5A5' : '#B91C1C',
              pointerEvents: 'none',
            }}
          >
            High Risk
          </div>
        </div>
        {showEvents && !hasEventsInRange && (
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            No macro events in this range.
          </div>
        )}
        {comparison !== 'None' && SIMILARITY_DATA[comparison] && (
          <div style={{ marginBottom: 20, marginTop: 4, fontSize: 14, fontStyle: 'italic', opacity: 0.9, textAlign: 'center', color: isDark ? '#9CA3AF' : '#4B5563' }}>
            "{SIMILARITY_DATA[comparison].takeaway}"
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Historical Context
            <InfoTooltip 
              text="This section compares the current economic conditions to significant historical periods to provide context on potential outcomes. All analyses are based on historical patterns, not future predictions." 
              isDark={isDark} 
            />
          </div>
          {comparison === 'None' ? (
            <p className="muted">Select a historical period to compare against the current risk timeline.</p>
          ) : (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Similarity Scores */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                 {Object.entries(SIMILARITY_DATA).map(([key, data]: [string, any]) => (
                   <div key={key} style={{ 
                     padding: '12px', 
                     border: `1px solid ${comparison === key ? (isDark ? '#3B82F6' : '#2563EB') : (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb')}`,
                     background: comparison === key ? (isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF') : 'transparent',
                     borderRadius: 8
                   }}>
                     <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Similarity to {key.split(' ')[0]}...</div>
                     <div style={{ fontSize: 20, fontWeight: 700, color: comparison === key ? (isDark ? '#60A5FA' : '#2563EB') : 'inherit' }}>
                       {data.score}
                     </div>
                   </div>
                 ))}
              </div>

              {/* Forward Looking Takeaway */}
              <div style={{ padding: 16, background: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF', borderRadius: 8, borderLeft: '4px solid #3B82F6' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: isDark ? '#93C5FD' : '#1E40AF', marginBottom: 6, letterSpacing: '0.05em' }}>Forward-Looking Takeaway</div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{SIMILARITY_DATA[comparison].takeaway}</div>
              </div>

              {/* Key Drivers */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Main contributors to current risk level:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SIMILARITY_DATA[comparison].drivers.map((driver: string) => (
                    <span key={driver} style={{ 
                      padding: '6px 12px', 
                      background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', 
                      borderRadius: 20, 
                      fontSize: 12,
                      border: '1px solid rgba(128,128,128,0.1)'
                    }}>
                      {driver}
                    </span>
                  ))}
                </div>
              </div>

              {/* Historical Outcomes Toggle */}
              <div>
                <button 
                  className="mini-btn" 
                  onClick={() => setShowHistoricalOutcomes(v => !v)}
                  style={{ width: '100%', justifyContent: 'center', padding: '8px 0' }}
                >
                  {showHistoricalOutcomes ? 'Hide historical outcomes' : 'Show historical outcomes (3–6–12 months)'}
                </button>
                {showHistoricalOutcomes && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
                    {Object.entries(SIMILARITY_DATA[comparison].outcomes).map(([period, outcome]: [string, any]) => (
                      <div key={period} style={{ padding: 12, background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{period.toUpperCase()}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{outcome}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {error && (
          <div className="card" style={{ borderColor: '#FCA5A5', background: '#FEF2F2', marginTop: 12 }}>
            {error}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
