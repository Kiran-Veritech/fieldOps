import { NavLink } from 'react-router-dom'
import { NAV } from './nav'

export function Sidebar() {
  return (
    <div
      style={{
        width: 216,
        flex: 'none',
        background: '#0B1220',
        borderRight: '1px solid #1E2A3D',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* logo lockup */}
      <div
        style={{
          height: 53,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '0 18px',
          borderBottom: '1px solid #1E2A3D',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            flex: 'none',
            background: '#070C16',
            border: '1px solid #2A3A52',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div style={{ width: 13, height: 13, border: '2px solid #16C0AE', borderRadius: '50%' }} />
          <div
            style={{ position: 'absolute', width: 3, height: 3, background: '#16C0AE', borderRadius: '50%' }}
          />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F4FA', letterSpacing: '-0.01em' }}>
          FieldOps <span style={{ color: '#16C0AE' }}>Nexus</span>
        </div>
      </div>

      {/* nav */}
      <div style={{ padding: '14px 10px', flex: 1 }}>
        <div
          className="mono"
          style={{ fontSize: 9, letterSpacing: '0.14em', color: '#3C4E6A', padding: '0 10px', marginBottom: 10 }}
        >
          WORKSPACE
        </div>

        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="navitem" style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 10px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  marginBottom: 2,
                  position: 'relative',
                  background: isActive ? '#0E1626' : 'transparent',
                }}
              >
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 2,
                      background: '#16C0AE',
                    }}
                  />
                )}
                <Icon stroke={isActive ? '#16C0AE' : '#5A6B84'} />
                <span
                  className="navlabel"
                  style={{
                    fontSize: 13,
                    color: isActive ? '#F0F4FA' : '#97A6BC',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>

      {/* footer */}
      <div
        style={{
          padding: '12px 18px',
          borderTop: '1px solid #1E2A3D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 10, color: '#5A6B84', display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#3FD07E',
              boxShadow: '0 0 7px #3FD07E',
              animation: 'fon-pulse 2.4s infinite',
            }}
          />
          NODE FON-01
        </span>
        <span className="mono" style={{ fontSize: 10, color: '#3C4E6A' }}>
          v1.0
        </span>
      </div>
    </div>
  )
}
