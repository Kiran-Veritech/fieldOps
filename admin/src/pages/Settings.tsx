import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useChrome } from '../components/shell/chrome'
import { initials } from '../lib/format'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export function Settings() {
  const { admin, logout } = useAuth()
  useChrome({ subtitle: 'WORKSPACE CONFIGURATION', showSearch: false })

  const email = admin?.workEmail ?? 'ops.admin@fieldops.io'
  const domain = email.split('@')[1] ?? 'fieldops.io'

  return (
    <div className="scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, maxWidth: 1100 }}>
        <Panel title="ACCESS CONTROL">
          <Row label="Approved email domains" value={<span className="mono" style={{ fontSize: 12, color: '#3DD5C6' }}>{domain}</span>} />
          <Row label="Registration" value="Domain allow-list enforced" />
          <Row label="Admin endpoints" value={<Lock text="ROLE-GUARDED" />} />
          <Note>Only work emails on an approved domain may register. The allow-list is managed in the backend configuration.</Note>
        </Panel>

        <Panel title="PRESENCE & SYNC">
          <Row label="Location ping interval" value={<span className="mono" style={{ fontSize: 12, color: '#C7D2E1' }}>10s</span>} />
          <Row label="Online window" value={<span className="mono" style={{ fontSize: 12, color: '#C7D2E1' }}>60s</span>} />
          <Row label="Admin auto-refresh" value={<span className="mono" style={{ fontSize: 12, color: '#3FD07E' }}>AUTO · 10s</span>} />
          <Note>Presence is derived on read: a user is ONLINE when a ping arrived within the last 60 seconds. It is never stored as a stale boolean.</Note>
        </Panel>

        <Panel title="AI TASK GENERATION">
          <Row label="Model timeout" value={<span className="mono" style={{ fontSize: 12, color: '#C7D2E1' }}>30s</span>} />
          <Row label="Human review" value={<Lock text="REQUIRED" accent="#3FD07E" />} />
          <Row label="Draft persistence" value="Nothing saved until commit" />
          <Note>Generated tasks are always drafts. A human reviews, edits, and assigns before anything is written to the project.</Note>
        </Panel>

        <Panel title="SYSTEM">
          <Row label="Node" value={<span className="mono" style={{ fontSize: 12, color: '#C7D2E1', display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 7px #3FD07E' }} />FON-01</span>} />
          <Row label="Version" value={<span className="mono" style={{ fontSize: 12, color: '#C7D2E1' }}>v1.0</span>} />
          <Row label="Backend" value={<span className="mono" style={{ fontSize: 12, color: '#3DD5C6' }}>{API_URL}</span>} />
        </Panel>

        <Panel title="SESSION" full>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '4px 0 14px' }}>
            <span className="mono" style={{ width: 42, height: 42, flex: 'none', borderRadius: 2, background: '#152134', border: '1px solid #2A3A52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#97A6BC' }}>{initials(admin?.fullName) || 'OA'}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F4FA' }}>{admin?.fullName ?? 'Ops Admin'}</div>
              <div className="mono" style={{ fontSize: 11, color: '#5A6B84', marginTop: 3 }}>{email} · CONTROL ROOM</div>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={() => { logout(); window.location.reload() }} className="kbtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#FF8F94', background: 'transparent', border: '1px solid rgba(240,68,56,0.4)', borderRadius: 2, padding: '10px 18px', cursor: 'pointer' }}>Sign out</button>
          </div>
          <Note>Signing out clears your tokens on this device. Access to the workspace is logged in the audit trail.</Note>
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, children, full = false }: { title: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '12px 16px', borderBottom: '1px solid #1E2A3D', background: '#0E1626' }}>{title}</div>
      <div style={{ padding: '6px 16px 16px' }}>{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #10192A' }}>
      <span style={{ fontSize: 13, color: '#C7D2E1' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#97A6BC' }}>{value}</span>
    </div>
  )
}

function Lock({ text, accent = '#97A6BC' }: { text: string; accent?: string }) {
  return <span className="mono" style={{ fontSize: 9, letterSpacing: '0.06em', color: accent, border: `1px solid ${accent}59`, borderRadius: 2, padding: '3px 8px' }}>{text}</span>
}

function Note({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: '#7C89A1', lineHeight: 1.5, marginTop: 12 }}>{children}</div>
}
