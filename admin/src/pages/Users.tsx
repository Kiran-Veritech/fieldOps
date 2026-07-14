import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChrome } from '../components/shell/chrome'
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type CategoryKey,
  designationColor,
} from '../data/designations'
import { api } from '../lib/api'
import { initials, secondsSince, timeAgo } from '../lib/format'

type User = {
  id: string
  fullName: string
  workEmail: string
  designation: string
  category: CategoryKey
  deviceId: string
  status: string
  lastPingAt: string | null
  online: boolean
  flags: { type: string }[]
}
type Project = { _id: string; name: string; memberIds: string[] }
type Asset = { ownerId: string }
type Row = User & { assetCount: number; project: string; flagged: boolean }

const POLL_MS = 10_000
const PAGE_SIZE = 12
const GRID = '38px 1.7fr 1.5fr 1.15fr 1.15fr 0.95fr 0.95fr 1.2fr 0.62fr 40px'
type SortKey = 'name' | 'last' | 'assets'

export function Users() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [assets, setAssets] = useState<Asset[]>([])

  const [q, setQ] = useState('')
  const [desig, setDesig] = useState<'all' | CategoryKey>('all')
  const [desigOpen, setDesigOpen] = useState(false)
  const [status, setStatus] = useState<'all' | 'online' | 'offline'>('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [dir, setDir] = useState<1 | -1>(1)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')

  const refresh = useCallback(async () => {
    const [u, p, a] = await Promise.all([
      api<{ items: User[] }>('/users?pageSize=200'),
      api<Project[]>('/projects'),
      api<Asset[]>('/assets'),
    ])
    setUsers(u.items)
    setProjects(p)
    setAssets(a)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
    const id = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const rows: Row[] = useMemo(() => {
    const assetCounts = new Map<string, number>()
    for (const a of assets) assetCounts.set(a.ownerId, (assetCounts.get(a.ownerId) ?? 0) + 1)
    const projectOf = new Map<string, string>()
    for (const p of projects) for (const m of p.memberIds) if (!projectOf.has(m)) projectOf.set(m, p.name)
    return users.map((u) => ({
      ...u,
      assetCount: assetCounts.get(u.id) ?? 0,
      project: projectOf.get(u.id) ?? 'Unassigned',
      flagged: (u.flags ?? []).some((f) => f.type === 'device_reused'),
    }))
  }, [users, projects, assets])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let out = rows
    if (query) out = out.filter((r) => r.fullName.toLowerCase().includes(query) || r.workEmail.toLowerCase().includes(query))
    if (desig !== 'all') out = out.filter((r) => r.category === desig)
    if (status === 'online') out = out.filter((r) => r.online)
    if (status === 'offline') out = out.filter((r) => !r.online)
    const sorted = [...out].sort((a, b) => {
      if (sort === 'name') return dir * a.fullName.localeCompare(b.fullName)
      if (sort === 'last') return dir * (secondsSince(a.lastPingAt) - secondsSince(b.lastPingAt))
      return dir * (a.assetCount - b.assetCount)
    })
    return sorted
  }, [rows, q, desig, status, sort, dir])

  useChrome({ subtitle: `DIRECTORY · ${users.length} OPERATORS`, showSearch: false })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const visibleIds = pageRows.map((r) => r.id)
  const allOn = visibleIds.length > 0 && visibleIds.every((id) => sel.has(id))

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir((d) => (d === 1 ? -1 : 1))
    else { setSort(k); setDir(1) }
  }
  const caret = (k: SortKey) => (sort !== k ? '↕' : dir === 1 ? '▲' : '▼')
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel((s) => {
    const n = new Set(s)
    if (allOn) visibleIds.forEach((id) => n.delete(id))
    else visibleIds.forEach((id) => n.add(id))
    return n
  })
  const copyDevice = (device: string) => {
    try { navigator.clipboard?.writeText(device) } catch { /* ignore */ }
    setToast(`Copied ${device}`)
    window.clearTimeout((copyDevice as unknown as { t?: number }).t)
    ;(copyDevice as unknown as { t?: number }).t = window.setTimeout(() => setToast(''), 1600)
  }

  const selCount = sel.size

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: 18 }}>
      {/* TOOLBAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', width: 280 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5A6B84" strokeWidth={1.5}><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search name or email…" style={{ fontFamily: 'inherit', fontSize: 12, color: '#C7D2E1', background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
        </div>

        {/* designation filter */}
        <div style={{ position: 'relative' }}>
          <div onClick={() => setDesigOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', cursor: 'pointer', minWidth: 180 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: desig === 'all' ? '#5A6B84' : CATEGORY_COLOR[desig], flex: 'none' }} />
            <span style={{ fontSize: 12, color: '#C7D2E1', flex: 1 }}>{desig === 'all' ? 'All designations' : CATEGORY_LABEL[desig]}</span>
            <span className="mono" style={{ color: '#5A6B84', fontSize: 11 }}>▾</span>
          </div>
          {desigOpen && (
            <div style={{ position: 'absolute', top: 40, left: 0, width: 210, background: '#0E1626', border: '1px solid #2A3A52', borderRadius: 2, boxShadow: '0 12px 30px rgba(0,0,0,0.6)', zIndex: 20, padding: 4 }}>
              <div className="kbtn" onClick={() => { setDesig('all'); setDesigOpen(false); setPage(1) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 12, color: '#C7D2E1' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#5A6B84', flex: 'none' }} />All designations
              </div>
              {CATEGORY_ORDER.map((key) => (
                <div key={key} className="kbtn" onClick={() => { setDesig(key); setDesigOpen(false); setPage(1) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 12, color: '#C7D2E1' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORY_COLOR[key], flex: 'none' }} />{CATEGORY_LABEL[key]}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* status segmented */}
        <div style={{ display: 'flex', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden' }}>
          {(['all', 'online', 'offline'] as const).map((p, i) => (
            <div key={p} onClick={() => { setStatus(p); setPage(1) }} className="mono" style={{ fontSize: 10, letterSpacing: '0.05em', padding: '9px 14px', cursor: 'pointer', borderRight: i < 2 ? '1px solid #1E2A3D' : undefined, background: status === p ? '#16C0AE' : 'transparent', color: status === p ? '#04060B' : '#97A6BC', fontWeight: status === p ? 600 : 400 }}>{p.toUpperCase()}</div>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>{filtered.length} matching</span>
        <button style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '9px 16px', cursor: 'pointer' }}>+ Add user</button>
      </div>

      {/* TABLE */}
      <div style={{ flex: 1, minHeight: 0, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', background: 'rgba(22,192,174,0.10)', borderBottom: '1px solid #16C0AE' }}>
            <span className="mono" style={{ fontSize: 11, color: '#7BF0E2', letterSpacing: '0.04em' }}>{selCount} SELECTED</span>
            <div style={{ width: 1, height: 16, background: '#1E2A3D' }} />
            <button className="kbtn" style={bulkBtn}>Assign to project</button>
            <button className="kbtn" style={bulkBtn}>Export</button>
            <button className="kbtn" style={{ ...bulkBtn, color: '#FF8F94', border: '1px solid rgba(240,68,56,0.4)' }}>Deactivate</button>
            <div style={{ flex: 1 }} />
            <span onClick={() => setSel(new Set())} className="mono" style={{ fontSize: 11, color: '#5A6B84', cursor: 'pointer' }}>CLEAR</span>
          </div>
        )}

        {/* header */}
        <div className="mono" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', padding: '10px 16px', background: '#0E1626', borderBottom: '1px solid #1E2A3D', fontSize: 9, letterSpacing: '0.09em', color: '#5A6B84' }}>
          <span onClick={toggleAll} style={{ width: 15, height: 15, border: `1px solid ${allOn ? '#16C0AE' : '#3C4E6A'}`, borderRadius: 2, background: allOn ? '#16C0AE' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#04060B', cursor: 'pointer' }}>{allOn ? '✓' : ''}</span>
          <span className="sorth" onClick={() => toggleSort('name')} style={{ color: '#5A6B84' }}>OPERATOR {caret('name')}</span>
          <span>WORK EMAIL</span>
          <span>DESIGNATION</span>
          <span>DEVICE ID</span>
          <span>STATUS</span>
          <span className="sorth" onClick={() => toggleSort('last')} style={{ color: '#5A6B84' }}>LAST ONLINE {caret('last')}</span>
          <span>PROJECT</span>
          <span className="sorth" onClick={() => toggleSort('assets')} style={{ color: '#5A6B84' }}>ASSETS {caret('assets')}</span>
          <span />
        </div>

        {/* rows */}
        <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {pageRows.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#97A6BC' }}>No operators match</span>
              <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>ADJUST YOUR FILTERS</span>
            </div>
          )}
          {pageRows.map((u) => {
            const on = sel.has(u.id)
            const color = designationColor(u.designation, u.category)
            const over1h = secondsSince(u.lastPingAt) > 3600
            return (
              <div key={u.id} className="urow" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #10192A', position: 'relative', background: u.flagged ? 'rgba(244,165,33,0.05)' : on ? 'rgba(22,192,174,0.05)' : 'transparent' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: u.flagged ? '#F4A521' : 'transparent' }} />
                <span onClick={() => toggleSel(u.id)} style={{ width: 15, height: 15, border: `1px solid ${on ? '#16C0AE' : '#3C4E6A'}`, borderRadius: 2, background: on ? '#16C0AE' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#04060B', cursor: 'pointer' }}>{on ? '✓' : ''}</span>
                <div onClick={() => navigate(`/users/${u.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, cursor: 'pointer' }}>
                  <span className="mono" style={{ width: 30, height: 30, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color }}>{initials(u.fullName)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#E8EDF4', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 7 }}>{u.fullName}{u.flagged && <span>⚠</span>}</div>
                    {u.flagged && <div style={{ marginTop: 2 }}><span className="mono" style={{ fontSize: 9, letterSpacing: '0.05em', color: '#FBBF3B', background: 'rgba(244,165,33,0.12)', borderRadius: 2, padding: '1px 6px' }}>DEVICE REUSED · REVIEW</span></div>}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 12, color: '#97A6BC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.workEmail}</span>
                <span style={{ fontSize: 12, color: '#C7D2E1', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.designation}</span></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span className="mono" style={{ fontSize: 11, color: u.flagged ? '#FF8A80' : '#97A6BC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.deviceId}</span>
                  <span className="copybtn" onClick={() => copyDevice(u.deviceId)} title="Copy device ID" style={{ color: '#5A6B84', cursor: 'pointer', flex: 'none', display: 'flex' }}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><rect x="5" y="5" width="9" height="9" rx="1" /><path d="M3 11V3a1 1 0 0 1 1-1h7" /></svg></span>
                </span>
                <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: u.online ? '#3FD07E' : '#94A0B4' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: u.online ? '#3FD07E' : '#64748B', boxShadow: u.online ? '0 0 6px #3FD07E' : 'none' }} />{u.online ? 'ONLINE' : 'OFFLINE'}</span>
                <span className="mono" style={{ fontSize: 11, color: over1h ? '#FF8F94' : u.online ? '#97A6BC' : '#7C89A1' }}>{timeAgo(u.lastPingAt)}</span>
                <span style={{ fontSize: 12, color: u.project === 'Unassigned' ? '#5A6B84' : '#C7D2E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.project}</span>
                <span className="mono" style={{ fontSize: 12, color: '#C7D2E1' }}>{u.assetCount}</span>
                <span style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <span className="kbtn" onClick={() => setMenu((m) => (m === u.id ? null : u.id))} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, color: '#5A6B84', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>⋯</span>
                  {menu === u.id && (
                    <div style={{ position: 'absolute', top: 28, right: 0, width: 168, background: '#0E1626', border: '1px solid #2A3A52', borderRadius: 2, boxShadow: '0 12px 30px rgba(0,0,0,0.6)', zIndex: 30, padding: 4 }}>
                      <div className="kbtn" onClick={() => { setMenu(null); navigate(`/users/${u.id}`) }} style={menuItem}>View detail</div>
                      <div className="kbtn" style={menuItem}>Assign to project</div>
                      <div className="kbtn" style={menuItem}>Reset device binding</div>
                      <div style={{ height: 1, background: '#1E2A3D', margin: '4px 0' }} />
                      <div className="kbtn" style={{ ...menuItem, color: '#FF8F94' }}>Deactivate</div>
                    </div>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* pagination */}
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid #1E2A3D', background: '#0E1626' }}>
          <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} operators
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="kbtn mono" onClick={() => setPage((p) => Math.max(1, p - 1))} style={pageBtn(false)}>‹ Prev</span>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <span key={n} className="mono" onClick={() => setPage(n)} style={pageBtn(n === safePage)}>{n}</span>
            ))}
            <span className="kbtn mono" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={pageBtn(false)}>Next ›</span>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', alignItems: 'center', gap: 10, background: '#0E1626', border: '1px solid #1E2A3D', borderLeft: '3px solid #16C0AE', borderRadius: 2, padding: '11px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 50 }}>
          <span style={{ width: 18, height: 18, borderRadius: 2, background: 'rgba(22,192,174,0.16)', color: '#7BF0E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
          <span className="mono" style={{ fontSize: 11, color: '#C7D2E1' }}>{toast}</span>
        </div>
      )}
    </div>
  )
}

const bulkBtn = { fontFamily: 'inherit', fontSize: 12, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '6px 12px', cursor: 'pointer' } as const
const menuItem = { padding: '8px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 12, color: '#C7D2E1' } as const
function pageBtn(active: boolean) {
  return {
    padding: active ? '6px 11px' : '6px 10px',
    border: `1px solid ${active ? '#16C0AE' : '#1E2A3D'}`,
    borderRadius: 2,
    fontSize: 11,
    color: active ? '#04060B' : '#97A6BC',
    background: active ? '#16C0AE' : 'transparent',
    cursor: 'pointer',
  } as const
}
