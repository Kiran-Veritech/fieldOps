import type { ReactNode } from 'react'

// Consistent empty (neutral) and error (signal) states, 1:1 with the
// Admin Utility Screens reference.

export function EmptyState({
  icon, title, body, action, positive = false,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
  positive?: boolean
}) {
  return (
    <div style={{ background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '26px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, minHeight: 230, justifyContent: 'center' }}>
      <span style={{ width: 46, height: 46, borderRadius: 2, background: positive ? 'rgba(34,197,94,0.1)' : 'transparent', border: `1px solid ${positive ? 'rgba(34,197,94,0.35)' : '#2A3A52'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#E8EDF4' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#7C89A1', marginTop: 6, lineHeight: 1.5 }}>{body}</div>
      </div>
      {action}
    </div>
  )
}

export function ErrorState({
  icon, title, body, code, accent = '#F04438', action,
}: {
  icon: ReactNode
  title: string
  body: string
  code: string
  accent?: string
  action?: ReactNode
}) {
  return (
    <div style={{ background: '#0C0A0A', border: '1px solid #1E2A3D', borderLeft: `3px solid ${accent}`, borderRadius: 2, padding: '26px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, minHeight: 230, justifyContent: 'center' }}>
      <span style={{ width: 46, height: 46, borderRadius: 2, background: `${accent}1a`, border: `1px solid ${accent}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FA' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#97A6BC', marginTop: 6, lineHeight: 1.5 }}>{body}</div>
        <div className="mono" style={{ fontSize: 10, color: accent === '#F04438' ? '#FF8F94' : '#F4A521', marginTop: 8 }}>{code}</div>
      </div>
      {action}
    </div>
  )
}

// Centered single-panel empty state used inside a full page body.
export function CenteredEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 }}>
      {icon}
      <div className="mono" style={{ fontSize: 11, color: '#3C4E6A', letterSpacing: '0.08em' }}>{text}</div>
    </div>
  )
}
