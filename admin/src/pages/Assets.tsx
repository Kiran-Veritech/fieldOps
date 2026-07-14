import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CenteredEmpty } from '../components/States'
import { useChrome } from '../components/shell/chrome'
import { type CategoryKey, designationColor } from '../data/designations'
import { api, ApiError } from '../lib/api'
import { initials, timeAgo } from '../lib/format'

type Asset = {
  _id: string
  ownerId: string
  name: string
  type: string
  serialNumber: string
  description: string
  photoUrl: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  adminNote: string | null
  reviewedAt: string | null
  createdAt: string
}
type User = { id: string; fullName: string; workEmail: string; designation: string; category: CategoryKey; deviceId: string; online: boolean }
type Project = { name: string; memberIds: string[] }

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED'
const TABS: { key: Tab; label: string; color: string; bg: string }[] = [
  { key: 'PENDING', label: 'PENDING', color: '#FBBF3B', bg: 'rgba(244,165,33,0.14)' },
  { key: 'APPROVED', label: 'APPROVED', color: '#5BE59A', bg: 'rgba(34,197,94,0.12)' },
  { key: 'REJECTED', label: 'REJECTED', color: '#FF8F94', bg: 'rgba(229,72,77,0.12)' },
]
const BADGE: Record<Tab, { color: string; bg: string; label: string }> = {
  PENDING: { color: '#FBBF3B', bg: 'rgba(244,165,33,0.12)', label: 'PENDING' },
  APPROVED: { color: '#5BE59A', bg: 'rgba(34,197,94,0.12)', label: 'APPROVED' },
  REJECTED: { color: '#FF8F94', bg: 'rgba(229,72,77,0.12)', label: 'REJECTED' },
}
const LIST_TITLE: Record<Tab, string> = {
  PENDING: 'PENDING SUBMISSIONS · NEWEST FIRST', APPROVED: 'APPROVED ASSETS', REJECTED: 'REJECTED SUBMISSIONS',
}
const EMPTY: Record<Tab, string> = {
  PENDING: 'QUEUE CLEAR · NO PENDING SUBMISSIONS', APPROVED: 'NO APPROVED ASSETS YET', REJECTED: 'NO REJECTED SUBMISSIONS',
}

export function Assets() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Asset[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tab, setTab] = useState<Tab>('PENDING')
  const [selId, setSelId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'rej' } | null>(null)

  useChrome({ subtitle: 'ENLISTMENT REVIEW QUEUE', showSearch: false })

  const load = useCallback(async () => {
    const [a, u, p] = await Promise.all([
      api<Asset[]>('/assets'),
      api<{ items: User[] }>('/users?pageSize=200'),
      api<Project[]>('/projects'),
    ])
    setAssets(a)
    setUsers(u.items)
    setProjects(p)
    return a
  }, [])

  useEffect(() => {
    load().then((a) => {
      const first = a.find((x) => x.status === 'PENDING') ?? a[0]
      if (first) { setSelId(first._id); setTab(first.status); setNote(first.adminNote ?? '') }
    }).catch(() => {})
  }, [load])

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const projectOf = useCallback((ownerId: string) => projects.find((p) => p.memberIds.includes(ownerId))?.name ?? '—', [projects])
  const counts = useMemo(() => ({
    PENDING: assets.filter((a) => a.status === 'PENDING').length,
    APPROVED: assets.filter((a) => a.status === 'APPROVED').length,
    REJECTED: assets.filter((a) => a.status === 'REJECTED').length,
  }), [assets])

  const rows = useMemo(() => assets.filter((a) => a.status === tab), [assets, tab])
  const sel = useMemo(() => assets.find((a) => a._id === selId && a.status === tab) ?? null, [assets, selId, tab])

  const selectTab = (t: Tab) => {
    setTab(t); setErr(false)
    const first = assets.find((a) => a.status === t)
    setSelId(first?._id ?? null)
    setNote(first?.adminNote ?? '')
  }
  const select = (a: Asset) => { setSelId(a._id); setNote(a.adminNote ?? ''); setErr(false) }

  const fireToast = (text: string, kind: 'ok' | 'rej') => {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), 2400)
  }

  const decide = async (decision: 'approve' | 'reject') => {
    if (!sel) return
    if (decision === 'reject' && !note.trim()) { setErr(true); return }
    setBusy(true)
    try {
      await api(`/assets/${sel._id}/decision`, { method: 'PATCH', body: { decision, adminNote: note.trim() || undefined } })
      const fresh = await load()
      fireToast(`${decision === 'approve' ? 'Approved' : 'Rejected'} ${sel.name}`, decision === 'approve' ? 'ok' : 'rej')
      const nextPending = fresh.find((x) => x.status === 'PENDING')
      setSelId(nextPending?._id ?? null)
      setNote(nextPending?.adminNote ?? '')
      setErr(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErr(true)
    } finally {
      setBusy(false)
    }
  }

  const owner = sel ? userById.get(sel.ownerId) : undefined
  const ownerColor = owner ? designationColor(owner.designation, owner.category) : '#4C8DFF'

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* tabs */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '0 18px', background: '#0B1220', borderBottom: '1px solid #1E2A3D' }}>
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <div key={t.key} onClick={() => selectTab(t.key)} className="mono" style={{ fontSize: 11, letterSpacing: '0.06em', padding: '14px 16px', cursor: 'pointer', borderBottom: `2px solid ${active ? '#16C0AE' : 'transparent'}`, color: active ? '#F0F4FA' : '#5A6B84', display: 'flex', alignItems: 'center', gap: 8 }}>
              {t.label}<span style={{ fontSize: 10, background: t.bg, color: t.color, borderRadius: 2, padding: '2px 7px' }}>{counts[t.key]}</span>
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* queue list */}
        <div style={{ width: 452, flex: 'none', borderRight: '1px solid #1E2A3D', background: '#0B1220', display: 'flex', flexDirection: 'column' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: '#5A6B84', padding: '11px 18px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', justifyContent: 'space-between' }}>
            <span>{LIST_TITLE[tab]}</span><span>{rows.length} ITEMS</span>
          </div>
          <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.length === 0 && <div className="mono" style={{ fontSize: 11, color: '#3C4E6A', padding: 18, letterSpacing: '0.08em' }}>{EMPTY[tab]}</div>}
            {rows.map((a) => {
              const u = userById.get(a.ownerId)
              const color = u ? designationColor(u.designation, u.category) : '#4C8DFF'
              const b = BADGE[a.status]
              const isSel = a._id === selId
              return (
                <div key={a._id} className="qrow" onClick={() => select(a)} style={{ display: 'flex', gap: 13, padding: '13px 18px', borderBottom: '1px solid #10192A', cursor: 'pointer', position: 'relative', background: isSel ? 'rgba(22,192,174,0.05)' : 'transparent' }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: isSel ? '#16C0AE' : 'transparent' }} />
                  {a.photoUrl ? (
                    <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 2, border: '1px solid #1E2A3D', background: 'repeating-linear-gradient(135deg,#131C2E,#131C2E 5px,#0E1626 5px,#0E1626 10px)', position: 'relative', overflow: 'hidden' }}>
                      <span className="mono" style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 7, color: '#5A6B84' }}>JPG</span>
                    </div>
                  ) : (
                    <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 2, border: '1px dashed #2A3A52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="mono" style={{ fontSize: 7, color: '#3C4E6A', textAlign: 'center' }}>NO<br />IMG</span></div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, color: '#E8EDF4', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                      <span className="mono" style={{ fontSize: 10, color: '#5A6B84', flex: 'none' }}>{timeAgo(a.createdAt)}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 3 }}>{a.type} · {a.serialNumber}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}><span className="mono" style={{ width: 20, height: 20, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color }}>{initials(u?.fullName)}</span><span style={{ fontSize: 11, color: '#97A6BC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u?.fullName ?? 'Unknown'}</span></span>
                      <span className="mono" style={{ flex: 'none', fontSize: 9, letterSpacing: '0.05em', color: b.color, background: b.bg, borderLeft: `2px solid ${b.color}`, borderRadius: 2, padding: '3px 7px' }}>{b.label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* review panel */}
        <div className="scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#070911' }}>
          {sel ? (
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 21, fontWeight: 700, color: '#F0F4FA', letterSpacing: '-0.01em' }}>{sel.name}</span>
                    <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.06em', color: BADGE[sel.status].color, background: BADGE[sel.status].bg, borderLeft: `2px solid ${BADGE[sel.status].color}`, borderRadius: 2, padding: '4px 9px' }}>{BADGE[sel.status].label}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: '#5A6B84', marginTop: 6 }}>{sel.type} · SUBMITTED {timeAgo(sel.createdAt)} ago</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 18 }}>
                {/* left */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>ATTACHED PHOTO</div>
                    {sel.photoUrl ? (
                      <div style={{ height: 250, border: '1px solid #1E2A3D', borderRadius: 2, background: 'repeating-linear-gradient(135deg,#131C2E,#131C2E 12px,#0E1626 12px,#0E1626 24px)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="mono" style={{ fontSize: 11, color: '#5A6B84', letterSpacing: '0.1em' }}>ASSET PHOTO · {sel.serialNumber}</span>
                        <span className="mono" style={{ position: 'absolute', top: 8, right: 10, fontSize: 9, color: '#5BC7BB', background: 'rgba(22,192,174,0.12)', borderRadius: 2, padding: '3px 8px' }}>PHOTO ATTACHED</span>
                      </div>
                    ) : (
                      <div style={{ height: 250, border: '1px dashed #2A3A52', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <svg width="30" height="30" viewBox="0 0 16 16" fill="none" stroke="#3C4E6A" strokeWidth={1.2}><rect x="1.5" y="3.5" width="13" height="9" rx="1" /><circle cx="8" cy="8" r="2.2" /><path d="M1.5 12.5L14.5 3.5" /></svg>
                        <span className="mono" style={{ fontSize: 10, color: '#3C4E6A', letterSpacing: '0.08em' }}>NO PHOTO SUBMITTED</span>
                      </div>
                    )}
                  </div>
                  <div style={{ border: '1px solid #1E2A3D', borderRadius: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #152134' }}><span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#5A6B84' }}>TYPE</span><span style={{ fontSize: 12, color: '#C7D2E1' }}>{sel.type}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #152134' }}><span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#5A6B84' }}>SERIAL NUMBER</span><span className="mono" style={{ fontSize: 12, color: '#3DD5C6' }}>{sel.serialNumber}</span></div>
                    <div style={{ padding: '12px 14px' }}><div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#5A6B84', marginBottom: 7 }}>DESCRIPTION</div><div style={{ fontSize: 13, color: '#C7D2E1', lineHeight: 1.5 }}>{sel.description || '—'}</div></div>
                  </div>
                </div>

                {/* right */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ border: '1px solid #1E2A3D', borderRadius: 2 }}>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', padding: '11px 14px', borderBottom: '1px solid #1E2A3D', background: '#0B1220' }}>SUBMITTED BY</div>
                    <div style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14 }}>
                        <span className="mono" style={{ width: 44, height: 44, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${ownerColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: ownerColor, position: 'relative' }}>{initials(owner?.fullName)}{owner?.online && <span style={{ position: 'absolute', bottom: -4, right: -4, width: 13, height: 13, borderRadius: '50%', background: '#3FD07E', border: '2px solid #070911' }} />}</span>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F4FA' }}>{owner?.fullName ?? 'Unknown operator'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: ownerColor }} /><span style={{ fontSize: 12, color: '#97A6BC' }}>{owner?.designation ?? '—'}</span></div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #152134' }}><span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>DEVICE ID</span><span className="mono" style={{ fontSize: 11, color: '#C7D2E1' }}>{owner?.deviceId ?? '—'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #152134' }}><span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>PROJECT</span><span style={{ fontSize: 12, color: '#C7D2E1' }}>{projectOf(sel.ownerId)}</span></div>
                      {owner && <div style={{ paddingTop: 10 }}><span onClick={() => navigate(`/users/${owner.id}`)} className="mono" style={{ fontSize: 11, color: '#3DD5C6', cursor: 'pointer' }}>VIEW OPERATOR PROFILE ›</span></div>}
                    </div>
                  </div>

                  {sel.status === 'PENDING' ? (
                    <div style={{ border: '1px solid #1E2A3D', borderRadius: 2, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                        <span className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84' }}>ADMIN NOTE</span>
                        <span className="mono" style={{ fontSize: 9, color: '#7C89A1' }}>OPTIONAL TO APPROVE · REQUIRED TO REJECT</span>
                      </div>
                      <textarea className="noteta" value={note} onChange={(e) => { setNote(e.target.value); setErr(false) }} placeholder="Add a note for the operator (required if rejecting)…" style={{ fontSize: 13, color: '#C7D2E1', background: '#070C16', border: `1px solid ${err ? '#E5484D' : '#1E2A3D'}`, borderRadius: 2, padding: '11px 13px', height: 84, lineHeight: 1.5 }} />
                      {err && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, color: '#FF8F94' }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#FF8F94" strokeWidth={1.5}><circle cx="8" cy="8" r="6.4" /><path d="M8 4.6v4.2M8 11.1v.1" /></svg>
                          <span className="mono" style={{ fontSize: 10 }}>A note is required to reject a submission.</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button onClick={() => decide('approve')} disabled={busy} className="apprbtn" style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#04060B', background: '#22C55E', border: 'none', borderRadius: 2, padding: '12px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#04060B" strokeWidth={2}><path d="M3 8.5l3.2 3.2L13 5" /></svg>Approve</button>
                        <button onClick={() => decide('reject')} disabled={busy} className="rejbtn" style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#FF8F94', background: 'transparent', border: '1px solid rgba(240,68,56,0.5)', borderRadius: 2, padding: '12px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#FF8F94" strokeWidth={2}><path d="M4 4l8 8M12 4l-8 8" /></svg>Reject</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #1E2A3D', borderLeft: `3px solid ${BADGE[sel.status].color}`, borderRadius: 2, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: BADGE[sel.status].color, letterSpacing: '0.04em' }}>{sel.status === 'APPROVED' ? 'APPROVED' : 'REJECTED'} BY OPS ADMIN{sel.reviewedAt ? ` · ${timeAgo(sel.reviewedAt)} ago` : ''}</span>
                      </div>
                      <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 7 }}>ADMIN NOTE</div>
                      <div style={{ fontSize: 13, color: '#C7D2E1', lineHeight: 1.5, background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '11px 13px', minHeight: 44 }}>{sel.adminNote || '— no note —'}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <CenteredEmpty
              icon={<svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="#2A3A52" strokeWidth={1}><path d="M8 1.6L14.4 5v6L8 14.4 1.6 11V5z" /><path d="M1.6 5L8 8.4 14.4 5M8 8.4v6" /></svg>}
              text={EMPTY[tab]}
            />
          )}
        </div>
      </div>

      {toast && (
        <div style={{ display: 'flex', position: 'absolute', bottom: 20, right: 20, alignItems: 'center', gap: 11, background: '#0E1626', border: '1px solid #1E2A3D', borderLeft: `3px solid ${toast.kind === 'rej' ? '#E5484D' : '#22C55E'}`, borderRadius: 2, padding: '12px 16px', boxShadow: '0 12px 34px rgba(0,0,0,0.7)', zIndex: 60 }}>
          <span style={{ width: 20, height: 20, borderRadius: 2, background: toast.kind === 'rej' ? 'rgba(229,72,77,0.16)' : 'rgba(34,197,94,0.16)', color: toast.kind === 'rej' ? '#E5484D' : '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{toast.kind === 'rej' ? '✕' : '✓'}</span>
          <span className="mono" style={{ fontSize: 12, color: '#C7D2E1' }}>{toast.text}</span>
        </div>
      )}
    </div>
  )
}
