import { useAuth } from '../../auth/AuthContext'
import { SearchIcon } from './icons'

function initials(name?: string): string {
  if (!name) return 'OA'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'OA'
}

export function TopBar({ title, subtitle, showSearch = true }: { title: string; subtitle?: string; showSearch?: boolean }) {
  const { admin } = useAuth()
  const name = admin?.fullName ?? 'Ops Admin'

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#070C16',
            border: '1px solid #1E2A3D',
            borderRadius: 2,
            padding: '8px 12px',
            width: 260,
          }}
        >
          <SearchIcon />
          <input
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
