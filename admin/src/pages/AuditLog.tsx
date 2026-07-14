import { useCallback, useEffect, useMemo, useState } from 'react'
import { useChrome } from '../components/shell/chrome'
import { api } from '../lib/api'
import { clockOf, initials } from '../lib/format'

type AuditRow = {
  _id: string
  at: string
  actorId: string | null
  actorLabel: string
  action: string
  entityType: string
  entityId: string
  payload: Record<string, unknown>
}

const ACTION_COLOR: Record<string, { color: string; bg: string }> = {
  approve: { color: '#5BE59A', bg: 'rgba(34,197,94,0.12)' },
  create: { color: '#5BE59A', bg: 'rgba(34,197,94,0.12)' },
  reject: { color: '#FF8F94', bg: 'rgba(229,72,77,0.12)' },
  flag: { color: '#FF8F94', bg: 'rgba(229,72,77,0.12)' },
  delete: { color: '#FF8F94', bg: 'rgba(229,72,77,0.12)' },
  generate: { color: '#7BF0E2', bg: 'rgba(22,192,174,0.12)' },
  assign: { color: '#7DB0FF', bg: 'rgba(59,130,246,0.12)' },
  update: { color: '#7DB0FF', bg: 'rgba(59,130,246,0.12)' },
  login: { color: '#94A0B4', bg: 'rgba(100,116,139,0.14)' },
}
const ACTOR_PALETTE = ['#2E6BF0', '#C084FC', '#F59E0B', '#06B6D4', '#FB7185', '#4338CA']
function actorColor(row: AuditRow): string {
  const l = row.actorLabel.toLowerCase()
  if (l.includes('system')) return '#5A6B84'
  if (l.includes('ai')) return '#16C0AE'
  let h = 0
  for (const ch of row.actorLabel) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ACTOR_PALETTE[h % ACTOR_PALETTE.length]
}
const ENTITY_TABS = ['ALL', 'User', 'Project', 'Task', 'Asset']
const POLL_MS = 10_000

export function AuditLog() {
  const [events, setEvents] = useState<AuditRow[]>([])
  const [q, setQ] = useState('')
  const [ent, setEnt] = useState('ALL')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    const rows = await api<AuditRow[]>('/audit?limit=200')
    setEvents(rows)
  }, [])

  useEffect(() => {
    refresh().then(() => setOpen((o) => (Object.keys(o).length ? o : {}))).catch(() => {})
    const t = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  useChrome({ subtitle: `IMMUTABLE · ${events.length.toLocaleString()} EVENTS`, showSearch: false })

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return events.filter((e) => {
      if (ent !== 'ALL' && e.entityType.toLowerCase() !== ent.toLowerCase()) return false
      if (query && !`${e.actorLabel} ${e.action} ${e.entityId}`.toLowerCase().includes(query)) return false
      return true
    })
  }, [events, q, ent])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* filter toolbar */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #1E2A3D', background: '#070911' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', width: 260 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5A6B84" strokeWidth={1.5}><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, entity…" style={{ fontFamily: 'inherit', fontSize: 12, color: '#C7D2E1', background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
        </div>
        <div className="mono kbtn" style={{ fontSize: 11, color: '#97A6BC', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>ACTOR: ALL <span style={{ color: '#5A6B84' }}>▾</span></div>
        <div className="mono kbtn" style={{ fontSize: 11, color: '#97A6BC', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>ACTION: ALL <span style={{ color: '#5A6B84' }}>▾</span></div>
        <span className="mono" style={{ fontSize: 9, color: '#3C4E6A', letterSpacing: '0.1em', marginLeft: 4 }}>ENTITY</span>
        <div style={{ display: 'flex', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden' }}>
          {ENTITY_TABS.map((name) => {
            const active = ent === name
            return <div key={name} onClick={() => setEnt(name)} className="mono" style={{ fontSize: 10, letterSpacing: '0.04em', padding: '9px 13px', cursor: 'pointer', borderRight: '1px solid #1E2A3D', background: active ? '#16C0AE' : 'transparent', color: active ? '#04060B' : '#97A6BC', fontWeight: active ? 600 : 400 }}>{name}</div>
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div className="mono kbtn" style={{ fontSize: 11, color: '#97A6BC', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', cursor: 'pointer' }}>Last 24h ▾</div>
      </div>

      {/* table */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#04060B' }}>
        <div className="mono" style={{ display: 'grid', gridTemplateColumns: '110px 1.3fr 128px 116px 168px 40px', gap: 12, alignItems: 'center', padding: '10px 18px', background: '#0E1626', borderBottom: '1px solid #1E2A3D', fontSize: 9, letterSpacing: '0.09em', color: '#5A6B84' }}>
          <span>TIMESTAMP</span><span>ACTOR</span><span>ACTION</span><span>ENTITY</span><span>ENTITY ID</span><span />
        </div>
        <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {rows.length === 0 && <div className="mono" style={{ fontSize: 11, color: '#3C4E6A', padding: 20, letterSpacing: '0.08em' }}>NO MATCHING EVENTS</div>}
          {rows.map((e) => {
            const am = ACTION_COLOR[e.action] ?? { color: '#97A6BC', bg: 'rgba(255,255,255,0.05)' }
            const isOpen = !!open[e._id]
            const ac = actorColor(e)
            const entityLabel = e.entityType ? e.entityType[0].toUpperCase() + e.entityType.slice(1) : '—'
            return (
              <div key={e._id}>
                <div className="arow" onClick={() => setOpen((o) => ({ ...o, [e._id]: !o[e._id] }))} style={{ display: 'grid', gridTemplateColumns: '110px 1.3fr 128px 116px 168px 40px', gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #10192A', cursor: 'pointer', background: isOpen ? '#0A101E' : 'transparent' }}>
                  <span className="mono" style={{ fontSize: 11, color: '#97A6BC' }}>{clockOf(e.at)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><span className="mono" style={{ width: 24, height: 24, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${ac}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: ac }}>{initials(e.actorLabel)}</span><span style={{ fontSize: 13, color: '#E8EDF4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.actorLabel}</span></span>
                  <span className="mono" style={{ justifySelf: 'start', fontSize: 9, letterSpacing: '0.05em', color: am.color, background: am.bg, borderLeft: `2px solid ${am.color}`, borderRadius: 2, padding: '4px 8px' }}>{e.action.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: '#C7D2E1' }}>{entityLabel}</span>
                  <span className="mono" style={{ fontSize: 12, color: '#3DD5C6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.entityId}</span>
                  <span style={{ display: 'flex', justifyContent: 'center', color: '#5A6B84', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s' }}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M4 6l4 4 4-4" /></svg></span>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 18px 14px 18px', background: '#0A101E', borderBottom: '1px solid #10192A' }}>
                    <div style={{ background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><span className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84' }}>PAYLOAD · application/json</span><span onClick={(ev) => { ev.stopPropagation(); navigator.clipboard?.writeText(JSON.stringify(e.payload, null, 2)) }} className="mono kbtn" style={{ fontSize: 9, color: '#3DD5C6', cursor: 'pointer', padding: '2px 6px' }}>COPY</span></div>
                      <div className="mono" style={{ fontSize: 12, lineHeight: 1.7 }}>
                        <div style={{ color: '#5A6B84' }}>{'{'}</div>
                        {Object.entries(e.payload).map(([k, v]) => {
                          const isNum = typeof v === 'number'
                          return <div key={k} style={{ paddingLeft: 20 }}><span style={{ color: '#5BC7BB' }}>"{k}"</span><span style={{ color: '#5A6B84' }}>: </span><span style={{ color: isNum ? '#7DB0FF' : '#F4C77A' }}>{JSON.stringify(v)}</span><span style={{ color: '#5A6B84' }}>,</span></div>
                        })}
                        {Object.keys(e.payload).length === 0 && <div style={{ paddingLeft: 20, color: '#3C4E6A' }}>— empty —</div>}
                        <div style={{ color: '#5A6B84' }}>{'}'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
