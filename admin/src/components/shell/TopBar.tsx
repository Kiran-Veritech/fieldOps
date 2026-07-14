import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useGlobalSearch } from './chrome'
import { SearchIcon } from './icons'

function initials(name?: string): string {
  if (!name) return 'OA'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'OA'
}

export function TopBar({ title, subtitle, showSearch = true }: { title: string; subtitle?: string; showSearch?: boolean }) {
  const { admin } = useAuth()
  const name = admin?.fullName ?? 'Ops Admin'
  const { searchQuery, setSearchQuery, searchHits, onSearchSelect, clearSearch } = useGlobalSearch()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    // Only open when a page has registered a search handler (e.g. Live Map).
    setOpen(!!onSearchSelect && searchQuery.trim().length > 0)
  }, [searchQuery, onSearchSelect])

  return (
    <div
      style={{
        height: 53,
        flex: 'none',
        background: '#0B1220',
        borderBottom: '1px solid #1E2A3D',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 20,
        position: 'relative',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#F0F4FA', letterSpacing: '-0.005em' }}>
          {title}
        </span>
      </div>
      {subtitle && (
        <span className="mono" style={{ fontSize: 10, color: '#3C4E6A', letterSpacing: '0.08em' }}>
          {subtitle}
        </span>
      )}
      <div style={{ flex: 1 }} />

      {showSearch && (
        <div ref={wrapRef} style={{ position: 'relative', width: 280 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#070C16',
              border: `1px solid ${open ? '#16C0AE' : '#1E2A3D'}`,
              borderRadius: 2,
              padding: '8px 12px',
            }}
          >
            <SearchIcon />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim() && searchHits.length) setOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  clearSearch()
                  setOpen(false)
                  ;(e.target as HTMLInputElement).blur()
                }
                if (e.key === 'Enter' && searchHits[0] && onSearchSelect) {
                  onSearchSelect(searchHits[0])
                  clearSearch()
                  setOpen(false)
                }
              }}
              placeholder="Search operators, projects…"
              style={{
                fontFamily: 'inherit',
                fontSize: 12,
                color: '#C7D2E1',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  clearSearch()
                  setOpen(false)
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#5A6B84',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {open && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#0B1220',
                border: '1px solid #1E2A3D',
                borderRadius: 2,
                boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                maxHeight: 320,
                overflowY: 'auto',
                zIndex: 50,
              }}
            >
              {searchHits.length === 0 ? (
                <div className="mono" style={{ padding: '12px 14px', fontSize: 11, color: '#5A6B84' }}>
                  No matches
                </div>
              ) : (
                searchHits.map((hit) => (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    type="button"
                    className="rowh"
                    onClick={() => {
                      onSearchSelect?.(hit)
                      clearSearch()
                      setOpen(false)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid #152134',
                      background: 'transparent',
                      padding: '10px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#E8EDF4', fontWeight: 500 }}>{hit.title}</div>
                    <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 3, letterSpacing: '0.04em' }}>
                      {hit.kind === 'operator' ? 'OPERATOR' : 'PROJECT'}
                      {hit.subtitle ? ` · ${hit.subtitle}` : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div
        className="mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 10,
          color: '#3FD07E',
          border: '1px solid #1E2A3D',
          borderRadius: 2,
          padding: '8px 11px',
          letterSpacing: '0.06em',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#3FD07E',
            boxShadow: '0 0 7px #3FD07E',
            animation: 'fon-pulse 1.6s infinite',
          }}
        />
        AUTO · 10s
      </div>

      <div style={{ width: 1, height: 24, background: '#1E2A3D' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          className="mono"
          style={{
            width: 30,
            height: 30,
            borderRadius: 2,
            background: '#152134',
            border: '1px solid #2A3A52',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: '#97A6BC',
          }}
        >
          {initials(admin?.fullName)}
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12, color: '#E8EDF4', fontWeight: 500 }}>{name}</div>
          <div className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>
            CONTROL ROOM
          </div>
        </div>
      </div>
    </div>
  )
}
