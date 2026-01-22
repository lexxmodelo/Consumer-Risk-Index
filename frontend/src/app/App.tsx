import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import logoUrl from '../assets/images/CSI-Logo_Light-FINAL.svg'
import logoDarkUrl from '../assets/images/CSI-Logo_Dark-FINAL.svg'
import dashboardLight from '../assets/images/Dashboard-Icon_Light.svg'
import dashboardDark from '../assets/images/Dashboard-Icon_Dark.svg'
import timelineLight from '../assets/images/RiskTimeline-Icon_Light.svg'
import timelineDark from '../assets/images/RiskTimeline-Icon_Dark.svg'
import { clearCache, getHealth, getCacheHealth, getRefreshStatus, refreshCache } from '../lib/api'

export default function App() {
  const [dark, setDark] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const getViewport = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    return w <= 640 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop'
  }
  const [viewport, setViewport] = useState<'mobile'|'tablet'|'desktop'>(getViewport())
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null
    return saved ? saved === 'true' : true
  })
  
  // Data Mode State
  const [modeIndicatorOpen, setModeIndicatorOpen] = useState(false)
  const [modeDisplay, setModeDisplay] = useState<'Database' | 'Cache' | 'API' | 'Mock' | 'Offline'>('Offline')
  const [modeColor, setModeColor] = useState<string>('#9CA3AF')
  const [modeHistory, setModeHistory] = useState<Array<{ mode: string; at: string }>>([])
  const [healthDetails, setHealthDetails] = useState<{ database?: string; cache?: string; api_key_configured?: boolean; last_run_time?: string | null; next_runs?: (string | null)[]; stale_count?: number; refresh_in_progress?: boolean; last_error?: string | null; last_error_at?: string | null }>({})
  const [adminToken, setAdminToken] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('admin.token') || '' : ''))
  const [overrideMode, setOverrideMode] = useState<string | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const health = await getHealth()
        const ch = await getCacheHealth()
        const rs = await getRefreshStatus()
        const dbStatus = health?.components?.database
        const cacheStatus = health?.components?.cache
        const apiConfigured = !!health?.components?.api_key_configured
        let m: 'Database' | 'Cache' | 'API' | 'Mock' | 'Offline' = 'Offline'
        if (dbStatus === 'connected') m = 'Database'
        else if (cacheStatus === 'active') m = 'Cache'
        else if (apiConfigured) m = 'API'
        else m = 'Mock'
        if (overrideMode) m = overrideMode as any
        setModeDisplay(m)
        const colorMap: Record<string, string> = { Database: '#16A34A', Cache: '#F59E0B', API: '#F97316', Mock: '#EF4444', Offline: '#9CA3AF' }
        setModeColor(colorMap[m])
        setModeHistory(h => [...h, { mode: m, at: new Date().toISOString() }].slice(-50))
        setHealthDetails({
          database: dbStatus,
          cache: cacheStatus,
          api_key_configured: apiConfigured,
          last_run_time: ch?.last_run_time || null,
          next_runs: ch?.next_scheduled_runs || [],
          stale_count: ch?.stale_series_count || 0,
          refresh_in_progress: rs?.in_progress || false,
          last_error: ch?.last_error || null,
          last_error_at: ch?.last_error_at || null,
        })
      } catch {
        setModeDisplay('Offline')
        setModeColor('#9CA3AF')
      }
    }
    poll()
    const id = setInterval(poll, 15000)
    return () => clearInterval(id)
  }, [overrideMode])

  useEffect(() => {
    const cls = dark ? 'theme-dark' : 'theme-light'
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(cls)
  }, [dark])
  useEffect(() => {
    const onResize = () => {
      const vp = getViewport()
      setViewport(vp)
      if (vp !== 'mobile') setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const timestamp = new Date().toLocaleString()
  // Cache status removed from sidebar; retain admin actions only
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('admin') === 'true'
  const sidebarClasses = [
    'sidebar',
    (viewport === 'mobile' || viewport === 'tablet') ? 'offcanvas' : '',
    viewport === 'mobile' && mobileOpen ? 'open' : '',
    viewport === 'tablet' && !sidebarCollapsed ? 'open' : '',
    viewport === 'tablet' && sidebarCollapsed ? 'collapsed' : ''
  ].filter(Boolean).join(' ')
  let touchStartX = 0
  const onTouchStart = (e: React.TouchEvent) => {
    if (viewport !== 'mobile' || !mobileOpen) return
    touchStartX = e.changedTouches[0].clientX
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (viewport !== 'mobile' || !mobileOpen) return
    const dx = e.changedTouches[0].clientX - touchStartX
    if (dx < -50) setMobileOpen(false)
  }
  return (
    <div className="app" style={{ display: 'flex', minHeight: '100vh' }}>
      {(viewport === 'mobile') && (
        <div className={`backdrop ${mobileOpen ? 'show' : ''}`} onClick={() => setMobileOpen(false)} />
      )}
      {(viewport === 'tablet') && (
        <div className={`backdrop ${!sidebarCollapsed ? 'show' : ''}`} onClick={() => setSidebarCollapsed(true)} />
      )}
      <aside className={sidebarClasses} onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <img src={dark ? logoDarkUrl : logoUrl} alt="CRI Logo" style={{ width: 50, height: 50 }} />
          <h1 className="sidebar-title">Consumer Risk Index</h1>
        </NavLink>
        <nav className="sidebar-nav">
          <NavLink
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            to="/"
            title="Dashboard"
            onClick={() => {
              if (viewport === 'mobile') setMobileOpen(false)
              if (viewport === 'tablet' && !sidebarCollapsed) setSidebarCollapsed(true)
            }}
          >
            <img src={dark ? dashboardDark : dashboardLight} alt="" aria-hidden="true" style={{ width: 18, height: 18 }} />
            <span className="nav-text">Dashboard</span>
          </NavLink>
          <NavLink
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            to="/timeline"
            title="Risk Timeline"
            onClick={() => {
              if (viewport === 'mobile') setMobileOpen(false)
              if (viewport === 'tablet' && !sidebarCollapsed) setSidebarCollapsed(true)
            }}
          >
            <img src={dark ? timelineDark : timelineLight} alt="" aria-hidden="true" style={{ width: 18, height: 18 }} />
            <span className="nav-text">Risk Timeline</span>
          </NavLink>
        </nav>
        <div style={{ padding: '0 16px', marginTop: 'auto', marginBottom: 12 }}>
          <div
            style={{ 
              background: modeColor, 
              color: '#fff', 
              padding: '6px 10px', 
              borderRadius: 6, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 8, 
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              width: '100%',
              boxSizing: 'border-box'
            }}
            title={`Mode: ${modeDisplay}\nDB: ${healthDetails.database}\nCache: ${healthDetails.cache}\nLast run: ${healthDetails.last_run_time || 'n/a'}\nNext: ${(healthDetails.next_runs || []).filter(Boolean).join(', ') || 'n/a'}\nStale: ${healthDetails.stale_count || 0}\nRefresh: ${healthDetails.refresh_in_progress ? 'In Progress' : 'Idle'}${healthDetails.last_error ? `\nLast Error: ${healthDetails.last_error}` : ''}`}
          >
            <span>Data Mode: {modeDisplay}</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <button className="risk-pill" onClick={() => setDark(d => !d)}>{dark ? 'Dark' : 'Light'} Mode</button>
          <div className="muted" style={{ marginTop: 8 }}>Last update: {timestamp}</div>
          {isAdmin && (
            <button className="mini-btn" style={{ marginTop: 8 }} onClick={async () => { try { await clearCache(); } catch {} }}>
              Force Refresh
            </button>
          )}
        </div>
      </aside>
      <main className="content">
        <div className="topbar">
          {viewport === 'mobile' && (
            <button className="hamburger" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
          )}
          <div className="topbar-title" style={{ display: (viewport === 'mobile' && mobileOpen) || (viewport === 'tablet' && !sidebarCollapsed) ? 'none' : 'block' }}>
            Consumer Risk Index
          </div>
          {viewport === 'tablet' && (
            <button className="collapse-btn" onClick={() => {
              const next = !sidebarCollapsed
              setSidebarCollapsed(next)
              localStorage.setItem('sidebarCollapsed', String(next))
            }} aria-label="Toggle sidebar">{sidebarCollapsed ? '⇥' : '⇤'}</button>
          )}
        </div>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      {modeIndicatorOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 520, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>System Health</div>
              <button className="mini-btn" onClick={() => setModeIndicatorOpen(false)}>Close</button>
            </div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div>Database: {String(healthDetails.database || '')}</div>
                <div>Cache: {String(healthDetails.cache || '')}</div>
                <div>API Key: {healthDetails.api_key_configured ? 'Configured' : 'Missing'}</div>
                <div>Last Run: {healthDetails.last_run_time || 'n/a'}</div>
                <div>Next Runs: {(healthDetails.next_runs || []).filter(Boolean).join(', ') || 'n/a'}</div>
                <div>Stale Count: {String(healthDetails.stale_count || 0)}</div>
                <div>Refresh: {healthDetails.refresh_in_progress ? 'In Progress' : 'Idle'}</div>
                {healthDetails.last_error && <div style={{ color: '#DC2626' }}>Last Error: {healthDetails.last_error}</div>}
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Mode Override</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['Database','Cache','API','Mock','Offline'].map(m => (
                    <button key={m} className="mini-btn" onClick={() => setOverrideMode(m)}>{m}</button>
                  ))}
                  <button className="mini-btn" onClick={() => setOverrideMode(null)}>Auto</button>
                </div>
                <div style={{ marginTop: 10 }}>Admin Token</div>
                <input
                  value={adminToken}
                  onChange={e => {
                    const v = e.target.value
                    setAdminToken(v)
                    if (typeof window !== 'undefined') localStorage.setItem('admin.token', v)
                  }}
                  placeholder="X-Admin-Token"
                  style={{ width: '100%', marginTop: 4 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="mini-btn" onClick={async () => { try { await refreshCache(adminToken); } catch {} }}>Refresh Cache</button>
                  <button className="mini-btn" onClick={async () => { try { await clearCache(adminToken); } catch {} }}>Clear Cache</button>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Mode History</div>
              <div style={{ maxHeight: 140, overflow: 'auto', fontSize: 12 }}>
                {modeHistory.slice().reverse().map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{h.mode}</span>
                    <span>{new Date(h.at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
