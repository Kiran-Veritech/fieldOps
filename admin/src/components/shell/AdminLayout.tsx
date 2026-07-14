import { Outlet, useLocation } from 'react-router-dom'
import { ChromeProvider, useChromeState } from './chrome'
import { NAV } from './nav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/** Thin bridge so AdminLayout can read chrome without re‑export churn. */
function Shell() {
  const { pathname } = useLocation()
  const active = NAV.find((n) => pathname.startsWith(n.to)) ?? NAV[0]
  const { chrome } = useChromeState()

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#04060B',
        color: '#C7D2E1',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title={active.label}
          subtitle={chrome.subtitle ?? active.subtitle}
          showSearch={chrome.showSearch}
        />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export function AdminLayout() {
  return (
    <ChromeProvider>
      <Shell />
    </ChromeProvider>
  )
}
