import { useCallback, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { type Chrome, ChromeContext } from './chrome'
import { NAV } from './nav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AdminLayout() {
  const { pathname } = useLocation()
  const active = NAV.find((n) => pathname.startsWith(n.to)) ?? NAV[0]
  const [chrome, setChrome] = useState<Chrome>({ showSearch: true })
  const set = useCallback((c: Chrome) => setChrome(c), [])

  return (
    <ChromeContext.Provider value={{ chrome, setChrome: set }}>
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
    </ChromeContext.Provider>
  )
}
