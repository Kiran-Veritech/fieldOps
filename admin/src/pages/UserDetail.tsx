import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useChrome } from '../components/shell/chrome'
import { type CategoryKey, designationColor } from '../data/designations'
import { api } from '../lib/api'
import { coord, initials } from '../lib/format'

type Geo = { lat: number; lng: number }
type User = {
  id: string
  fullName: string
  workEmail: string
  designation: string
  category: CategoryKey
  deviceId: string
  appVersion: string
  online: boolean
  initialLocation: Geo | null
}
type Detail = {
  user: User
  registration: { deviceId: string; appVersion: string; initialLocation: Geo | null; createdAt: string | null }
  locationHistory: { lat: number; lng: number; at: string }[]
}
type Project = { _id: string; code: string; name: string; status: string; memberIds: string[] }
type Task = { _id: string; title: string; projectId: string; status: string; source: string; blockedReason: string | null }
type Asset = { _id: string; ownerId: string; name: string; type: string; serialNumber: string; status: string }

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function UserDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  useChrome({ subtitle: 'USER DETAIL', showSearch: false })

  const [detail, setDetail] = useState<Detail | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, p, t, a] = await Promise.all([
        api<Detail>(`/users/${id}`),
        api<Project[]>('/projects'),
        api<Task[]>(`/tasks?assigneeId=${id}`),
        api<Asset[]>('/assets'),
      ])
      setDetail(d)
      setProjects(p)
      setTasks(t)
      setAssets(a.filter((x) => x.ownerId === id))
    } catch {
      setNotFound(true)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const myProjects = useMemo(() => projects.filter((p) => p.memberIds.includes(id)), [projects, id])
  const projById = useMemo(() => new Map(projects.map((p) => [p._id, p])), [projects])

  if (notFound) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 15, color: '#F0F4FA' }}>Operator not found</span>
        <span onClick={() => navigate('/users')} className="mono" style={{ fontSize: 11, color: '#3DD5C6', cursor: 'pointer' }}>‹ BACK TO USERS</span>
      </div>
    )
  }
  if (!detail) {
    return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="mono" style={{ fontSize: 11, color: '#5A6B84', letterSpacing: '0.12em' }}>LOADING…</span></div>
  }

  const u = detail.user
  const color = designationColor(u.designation, u.category)
  const taskCounts = {
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
    done: tasks.filter((t) => t.status === 'COMPLETED').length,
  }
  const approved = assets.filter((a) => a.status === 'APPROVED').length

  return (
    <div className="scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: '18px 22px' }}>
        {/* breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span onClick={() => navigate('/users')} className="mono" style={{ fontSize: 11, color: '#3DD5C6', cursor: 'pointer', letterSpacing: '0.04em' }}>‹ USERS</span>
          <span className="mono" style={{ fontSize: 11, color: '#3C4E6A' }}>/</span>
          <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>{u.fullName}</span>
        </div>

        {/* profile header */}
        <div style={{ background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '22px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ width: 76, height: 76, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <span className="mono" style={{ fontSize: 26, fontWeight: 700, color }}>{initials(u.fullName)}</span>
            {u.online && <span style={{ position: 'absolute', bottom: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#3FD07E', border: '2px solid #0B1220', boxShadow: '0 0 8px #3FD07E' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#F0F4FA', letterSpacing: '-0.01em' }}>{u.fullName}</span>
              <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.06em', color: u.online ? '#3FD07E' : '#94A0B4', border: `1px solid ${u.online ? 'rgba(63,208,126,0.35)' : '#1E2A3D'}`, borderRadius: 2, padding: '4px 10px' }}>{u.online ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 9 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#97A6BC' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />{u.designation}</span>
              <span className="mono" style={{ fontSize: 12, color: '#5A6B84' }}>{u.workEmail}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/live-map" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '10px 16px', textDecoration: 'none' }}>View on map</Link>
            <button className="kbtn" style={ghostBtn}>Message</button>
            <button className="kbtn" style={{ ...ghostBtn, color: '#FF8F94', border: '1px solid rgba(240,68,56,0.4)' }}>Deactivate</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.4fr', gap: 16 }}>
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="REGISTRATION METADATA">
              <MetaRow label="DEVICE ID" value={detail.registration.deviceId} valueColor="#3DD5C6" />
              <MetaRow label="APP VERSION" value={detail.registration.appVersion || '—'} />
              <MetaRow label="REGISTERED AT" value={`${fmtDateTime(detail.registration.createdAt)}`} />
              <MetaRow label="INITIAL LOCATION" value={coord(detail.registration.initialLocation)} />
              <MetaRow label="DESIGNATION SET" last node={<span style={{ fontSize: 12, color: '#C7D2E1', display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />{u.designation}</span>} />
            </Panel>

            <Panel title="LOCATION HISTORY · 24H" right={<span style={{ color: '#5BC7BB' }}>{detail.locationHistory.length} PINGS</span>}>
              <LocationHistoryMap points={detail.locationHistory} pinColor={color} />
            </Panel>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="ASSIGNED PROJECTS" right={<span>{myProjects.length}</span>}>
              {myProjects.length === 0 && <Empty text="No projects assigned" />}
              {myProjects.map((p, i) => (
                <div key={p._id} className="urow" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < myProjects.length - 1 ? '1px solid #10192A' : undefined, borderLeft: '2px solid #16C0AE', cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: '#E8EDF4' }}>{p.name}</div><div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 3 }}>{p.code} · {p.memberIds.length} OPERATORS</div></div>
                  <ProjectStatusBadge status={p.status} />
                </div>
              ))}
            </Panel>

            <Panel title="TASKS" right={
              <span style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: '#7DB0FF' }}>{taskCounts.inProgress} IN PROGRESS</span>
                <span style={{ color: '#FF8F94' }}>{taskCounts.blocked} BLOCKED</span>
                <span style={{ color: '#5BE59A' }}>{taskCounts.done} DONE</span>
              </span>
            }>
              {tasks.length === 0 && <Empty text="No tasks assigned" />}
              {tasks.map((t, i) => (
                <div key={t._id} className="urow" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < tasks.length - 1 ? '1px solid #10192A' : undefined, borderLeft: `2px solid ${taskLeft(t.status)}`, cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: '#E8EDF4' }}>{t.title}</div><div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 3 }}>{(projById.get(t.projectId)?.name ?? '—').toUpperCase()} · {t.source === 'ai' ? 'AI-GEN' : 'MANUAL'}</div></div>
                  <TaskStatusChip status={t.status} />
                </div>
              ))}
            </Panel>

            <Panel title="SUBMITTED ASSETS" right={<span style={{ color: '#5BE59A' }}>{approved} APPROVED</span>}>
              {assets.length === 0 && <Empty text="No assets submitted" />}
              {assets.map((a, i) => (
                <div key={a._id} className="urow" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < assets.length - 1 ? '1px solid #10192A' : undefined, cursor: 'pointer' }}>
                  <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 2, background: '#152134', border: '1px solid #1E2A3D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#5A6B84" strokeWidth={1.3}><rect x="2" y="4" width="12" height="8" rx="1" /><circle cx="8" cy="8" r="2" /></svg>
                  </span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: '#E8EDF4' }}>{a.name}</div><div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 3 }}>{a.type.toUpperCase()} · {a.serialNumber}</div></div>
                  <AssetStatusChip status={a.status} />
                </div>
              ))}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '10px 16px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>{right}
      </div>
      <div>{children}</div>
    </div>
  )
}

function MetaRow({ label, value, valueColor, node, last }: { label: string; value?: string; valueColor?: string; node?: ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: last ? undefined : '1px solid #152134' }}>
      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#5A6B84' }}>{label}</span>
      {node ?? <span className="mono" style={{ fontSize: 12, color: valueColor ?? '#C7D2E1' }}>{value}</span>}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="mono" style={{ fontSize: 11, color: '#5A6B84', padding: '16px' }}>{text}</div>
}

function LocationHistoryMap({ points, pinColor }: { points: { lat: number; lng: number; at: string }[]; pinColor: string }) {
  const W = 440, H = 220, pad = 34
  const geo = useMemo(() => {
    if (points.length === 0) return null
    const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const spanLat = maxLat - minLat || 0.001, spanLng = maxLng - minLng || 0.001
    const proj = points.map((p) => ({
      x: pad + ((p.lng - minLng) / spanLng) * (W - 2 * pad),
      y: H - (pad + ((p.lat - minLat) / spanLat) * (H - 2 * pad)),
    }))
    // chronological: history comes newest-first, reverse for the path
    return proj.slice().reverse()
  }, [points])

  return (
    <div style={{ position: 'relative', height: 220, background: '#070C16', backgroundImage: 'linear-gradient(rgba(120,150,190,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(120,150,190,0.05) 1px,transparent 1px)', backgroundSize: '26px 26px', overflow: 'hidden' }}>
      {!geo && <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#5A6B84' }}>NO PINGS IN WINDOW</div>}
      {geo && (
        <>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <polyline points={geo.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ')} fill="none" stroke="#16C0AE" strokeWidth="2" strokeOpacity="0.8" />
          </svg>
          <div style={{ position: 'absolute', top: geo[0].y, left: geo[0].x, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: '#0B1220', border: '2px solid #64748B' }} />
          <div className="mono" style={{ position: 'absolute', top: geo[0].y + 10, left: geo[0].x, transform: 'translateX(-50%)', fontSize: 8, color: '#5A6B84' }}>START</div>
          <div style={{ position: 'absolute', top: geo[geo.length - 1].y, left: geo[geo.length - 1].x, transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', background: pinColor, boxShadow: `0 0 0 3px #04060B,0 0 12px ${pinColor}` }} />
          <div className="mono" style={{ position: 'absolute', top: geo[geo.length - 1].y - 26, left: geo[geo.length - 1].x, transform: 'translateX(-50%)', fontSize: 8, color: '#5BC7BB' }}>NOW</div>
        </>
      )}
      <div className="mono" style={{ position: 'absolute', top: 10, right: 12, fontSize: 9, letterSpacing: '0.2em', color: '#2F3E56' }}>GURUGRAM</div>
    </div>
  )
}

function ProjectStatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; b: string }> = {
    ACTIVE: { c: '#5BE59A', b: 'rgba(34,197,94,0.35)' },
    AT_RISK: { c: '#FBBF3B', b: 'rgba(244,165,33,0.35)' },
    PLANNING: { c: '#7DB0FF', b: 'rgba(59,130,246,0.35)' },
    COMPLETED: { c: '#94A0B4', b: '#1E2A3D' },
  }
  const s = map[status] ?? map.PLANNING
  return <span className="mono" style={{ fontSize: 10, color: s.c, border: `1px solid ${s.b}`, borderRadius: 2, padding: '3px 8px' }}>{status}</span>
}

function taskLeft(status: string): string {
  return status === 'BLOCKED' ? '#F04438' : status === 'COMPLETED' ? '#22C55E' : status === 'IN_PROGRESS' ? '#3B82F6' : '#3C4E6A'
}
function TaskStatusChip({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; bar: string }> = {
    IN_PROGRESS: { c: '#7DB0FF', bg: 'rgba(59,130,246,0.12)', bar: '#3B82F6' },
    BLOCKED: { c: '#FF8A80', bg: 'rgba(240,68,56,0.12)', bar: '#F04438' },
    COMPLETED: { c: '#5BE59A', bg: 'rgba(34,197,94,0.12)', bar: '#22C55E' },
    PENDING: { c: '#94A0B4', bg: 'rgba(100,116,139,0.12)', bar: '#3C4E6A' },
  }
  const s = map[status] ?? map.PENDING
  return <span className="mono" style={{ fontSize: 10, color: s.c, background: s.bg, borderLeft: `2px solid ${s.bar}`, borderRadius: 2, padding: '4px 9px' }}>{status.replace('_', ' ')}</span>
}
function AssetStatusChip({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; bar: string }> = {
    APPROVED: { c: '#5BE59A', bg: 'rgba(34,197,94,0.12)', bar: '#22C55E' },
    PENDING: { c: '#FBBF3B', bg: 'rgba(244,165,33,0.12)', bar: '#F4A521' },
    REJECTED: { c: '#FF8A80', bg: 'rgba(240,68,56,0.12)', bar: '#F04438' },
  }
  const s = map[status] ?? map.PENDING
  return <span className="mono" style={{ fontSize: 10, color: s.c, background: s.bg, borderLeft: `2px solid ${s.bar}`, borderRadius: 2, padding: '4px 9px' }}>{status}</span>
}

const ghostBtn = { fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '10px 16px', cursor: 'pointer' } as const
