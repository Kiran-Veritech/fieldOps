import { useEffect, useMemo, useState } from 'react'
import { type CategoryKey, designationColor } from '../../data/designations'
import { api } from '../../lib/api'
import { initials } from '../../lib/format'

type User = {
  id: string
  fullName: string
  workEmail: string
  designation: string
  category: CategoryKey
  online: boolean
}

export function AddMembersModal({
  projectId, projectName, projectCode, existingMemberIds, onClose, onAdded,
}: {
  projectId: string
  projectName: string
  projectCode: string
  existingMemberIds: string[]
  onClose: () => void
  onAdded: () => void
}) {
  const [pool, setPool] = useState<User[]>([])
  const [mq, setMq] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const existing = new Set(existingMemberIds)
    api<{ items: User[] }>('/users?pageSize=200')
      .then((r) => setPool(r.items.filter((u) => !existing.has(u.id))))
      .catch(() => {})
  }, [existingMemberIds])

  const candidates = useMemo(() => {
    const q = mq.trim().toLowerCase()
    if (!q) return pool
    return pool.filter((c) => c.fullName.toLowerCase().includes(q) || c.designation.toLowerCase().includes(q))
  }, [pool, mq])

  const chosen = pool.filter((p) => sel.has(p.id))
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const add = async () => {
    if (sel.size === 0) return
    setSaving(true)
    try {
      await api(`/projects/${projectId}/members`, { method: 'POST', body: { userIds: [...sel] } })
      onAdded()
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,6,11,0.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 720, maxHeight: 660, background: '#0B1220', border: '1px solid #2A3A52', borderRadius: 2, boxShadow: '0 24px 60px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 2, background: '#16C0AE' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1E2A3D', background: '#0E1626' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4FA' }}>Add members</div>
            <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 3 }}>{projectName.toUpperCase()} · {projectCode}</div>
          </div>
          <span onClick={onClose} className="mono" style={{ color: '#97A6BC', fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>×</span>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* candidates */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1E2A3D' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #10192A' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5A6B84" strokeWidth={1.5}><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
                <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Search people by name or designation…" style={{ fontFamily: 'inherit', fontSize: 12, color: '#C7D2E1', background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
              </div>
            </div>
            <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', maxHeight: 420 }}>
              {candidates.length === 0 && <div className="mono" style={{ fontSize: 11, color: '#5A6B84', padding: 18 }}>No available people</div>}
              {candidates.map((c) => {
                const on = sel.has(c.id)
                const color = designationColor(c.designation, c.category)
                return (
                  <div key={c.id} className="rowh" onClick={() => toggle(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid #10192A', cursor: 'pointer', background: on ? 'rgba(22,192,174,0.06)' : 'transparent' }}>
                    <span style={{ width: 16, height: 16, flex: 'none', border: `1px solid ${on ? '#16C0AE' : '#3C4E6A'}`, borderRadius: 2, background: on ? '#16C0AE' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#04060B' }}>{on ? '✓' : ''}</span>
                    <span className="mono" style={{ width: 30, height: 30, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color, position: 'relative' }}>{initials(c.fullName)}{c.online && <span style={{ position: 'absolute', bottom: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: '#3FD07E', border: '1.5px solid #0B1220' }} />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#E8EDF4', fontWeight: 500 }}>{c.fullName}</div>
                      <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 2 }}>{c.workEmail}</div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} /><span style={{ fontSize: 11, color: '#97A6BC' }}>{c.designation}</span></span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* selected */}
          <div style={{ width: 220, flex: 'none', display: 'flex', flexDirection: 'column', background: '#0A101E' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: '#5A6B84', padding: '14px 16px 10px' }}>SELECTED · {sel.size}</div>
            <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chosen.map((c) => {
                const color = designationColor(c.designation, c.category)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#0E1626', border: '1px solid #1E2A3D', borderRadius: 2, padding: '7px 9px' }}>
                    <span className="mono" style={{ width: 22, height: 22, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color }}>{initials(c.fullName)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#E8EDF4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.fullName}</span>
                    <span onClick={() => toggle(c.id)} className="mono" style={{ color: '#5A6B84', fontSize: 12, cursor: 'pointer', flex: 'none' }}>×</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #1E2A3D', background: '#0E1626' }}>
          <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>{sel.size} of {pool.length} available selected</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="kbtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '10px 18px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={add} disabled={sel.size === 0 || saving} style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '10px 18px', cursor: sel.size === 0 ? 'not-allowed' : 'pointer', opacity: sel.size === 0 ? 0.5 : 1 }}>{saving ? 'Adding…' : `Add ${sel.size} members`}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
