import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_TAG,
  type CategoryKey,
  designationColor,
} from '../data/designations'
import { clusterPlaced, type Placed } from '../map/cluster'
import { inView, project } from '../map/projection'

type Geo = { lat: number; lng: number }
type User = {
  id: string
  fullName: string
  workEmail: string
  designation: string
  category: CategoryKey
  deviceId: string
  status: string
  lastPingAt: string | null
  lastLocation: Geo | null
  initialLocation: (Geo & { capturedAt?: string }) | null
  createdAt: string | null
  online: boolean
}
type Project = { _id: string; code: string; name: string; memberIds: string[] }
type Detail = {
  user: User
  registration: { deviceId: string; initialLocation: Geo | null; createdAt: string | null }
  locationHistory: { lat: number; lng: number; at: string }[]
}

const POLL_MS = 10_000

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${Math.floor(secs)}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`
  return `${Math.floor(secs / 86400)}d`
}
const coord = (g: Geo | null) => (g ? `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}` : '—')
const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function LiveMap() {
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [counts, setCounts] = useState({ onboarded: 0, online: 0, offline: 0 })

  const [presence, setPresence] = useState<'all' | 'online' | 'offline'>('all')
  const [cats, setCats] = useState<Record<CategoryKey, boolean>>({
    Engineering: true,
    Quality: true,
    Delivery: true,
    Operations: true,
    Business: true,
  })
  const [projectId, setProjectId] = useState<string>('')
  const [projectOpen, setProjectOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)

  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 50, y: 50 })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)

  const refresh = useCallback(async () => {
    const [u, p, s] = await Promise.all([
      api<{ items: User[] }>('/users?pageSize=200'),
      api<Project[]>('/projects'),
      api<{ counts: { onboarded: number; online: number; offline: number } }>('/dashboard/summary'),
    ])
    setUsers(u.items)
    setProjects(p)
    setCounts(s.counts)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
    const id = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Load operator detail when a pin is selected.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    api<Detail>(`/users/${selectedId}`)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const memberSet = useMemo(() => {
    if (!projectId) return null
    const proj = projects.find((p) => p._id === projectId)
    return proj ? new Set(proj.memberIds) : new Set<string>()
  }, [projectId, projects])

  const catCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const u of users) c[u.category] = (c[u.category] ?? 0) + 1
    return c
  }, [users])

  // Filter → project → cluster.
  const placed: Placed<User>[] = useMemo(() => {
    const out: Placed<User>[] = []
    for (const u of users) {
      if (!u.lastLocation) continue
      if (presence === 'online' && !u.online) continue
      if (presence === 'offline' && u.online) continue
      if (!cats[u.category]) continue
      if (memberSet && !memberSet.has(u.id)) continue
      const pt = project(u.lastLocation.lat, u.lastLocation.lng, zoom, center)
      if (!inView(pt)) continue
      out.push({ item: u, pt })
    }
    return out
  }, [users, presence, cats, memberSet, zoom, center])

  const clusters = useMemo(() => clusterPlaced(placed, zoom), [placed, zoom])
  const selected = users.find((u) => u.id === selectedId) ?? null

  const zoomToCluster = (items: Placed<User>[]) => {
    const lat = items.reduce((s, p) => s + (p.item.lastLocation?.lat ?? 0), 0) / items.length
    const lng = items.reduce((s, p) => s + (p.item.lastLocation?.lng ?? 0), 0) / items.length
    setCenter(project(lat, lng, 1)) // base-coordinate centre
    setZoom((z) => Math.min(z * 1.9, 7))
  }

  const resetFilters = () => {
    setPresence('all')
    setCats({ Engineering: true, Quality: true, Delivery: true, Operations: true, Business: true })
    setProjectId('')
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#070C16',
        backgroundImage:
          'linear-gradient(rgba(120,150,190,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(120,150,190,0.045) 1px,transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <MapTerrain />

      {/* clusters + pins — small groups (≤2) stay as individual pins */}
      {clusters.map((cl, i) =>
        cl.items.length > 2 ? (
          <ClusterBubble key={`c${i}`} x={cl.x} y={cl.y} count={cl.items.length} onClick={() => zoomToCluster(cl.items)} />
        ) : (
          cl.items.map((it) => (
            <Pin
              key={it.item.id}
              placed={it}
              selected={it.item.id === selectedId}
              onClick={() => setSelectedId(it.item.id)}
            />
          ))
        ),
      )}

      <CounterStrip counts={counts} />
      <FilterPanel
        presence={presence}
        setPresence={setPresence}
        cats={cats}
        setCats={setCats}
        catCounts={catCounts}
        reset={resetFilters}
        projects={projects}
        projectId={projectId}
        setProjectId={setProjectId}
        projectOpen={projectOpen}
        setProjectOpen={setProjectOpen}
      />
      <Legend open={legendOpen} toggle={() => setLegendOpen((o) => !o)} />
      <ZoomControl
        onIn={() => setZoom((z) => Math.min(z * 1.4, 7))}
        onOut={() => setZoom((z) => Math.max(z / 1.4, 1))}
      />

      {selected && detail && (
        <DetailDrawer
          user={selected}
          detail={detail}
          project={projects.find((p) => p.memberIds.includes(selected.id)) ?? null}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Map terrain + labels (decorative, matches the reference)            */
/* ------------------------------------------------------------------ */
function MapTerrain() {
  return (
    <>
      <div style={{ position: 'absolute', top: -40, left: '20%', width: 3, height: '120%', background: 'rgba(120,150,190,0.10)', transform: 'rotate(18deg)', transformOrigin: 'top' }} />
      <div style={{ position: 'absolute', top: '36%', left: '-5%', width: '110%', height: 2, background: 'rgba(120,150,190,0.10)', transform: 'rotate(-7deg)' }} />
      <div style={{ position: 'absolute', top: 0, left: '52%', width: 2, height: '100%', background: 'rgba(120,150,190,0.08)', transform: 'rotate(-12deg)' }} />
      <div style={{ position: 'absolute', top: '64%', left: '-5%', width: '80%', height: 2, background: 'rgba(120,150,190,0.08)', transform: 'rotate(6deg)' }} />
      <div style={{ position: 'absolute', bottom: '8%', right: '22%', width: 220, height: 130, background: 'rgba(30,120,150,0.07)', border: '1px solid rgba(60,150,180,0.12)', borderRadius: '48% 52% 55% 45%', transform: 'rotate(-14deg)' }} />
      <div style={{ position: 'absolute', top: '12%', left: '30%', width: 170, height: 120, background: 'rgba(40,120,70,0.06)', border: '1px solid rgba(60,150,90,0.1)', borderRadius: '45% 55% 50% 50%' }} />
      <Label style={{ top: '5%', right: '9%' }} size={12} ls="0.28em" color="#2F3E56">DELHI</Label>
      <Label style={{ top: '47%', left: '24%' }} size={13} ls="0.24em" color="#3C4E6A">GURUGRAM</Label>
      <Label style={{ top: '20%', left: '40%' }} size={9} ls="0.16em" color="#2F3E56">DLF CYBER CITY</Label>
      <Label style={{ top: '70%', left: '14%' }} size={9} ls="0.16em" color="#2F3E56">SOHNA ROAD</Label>
      <Label style={{ top: '60%', left: '44%' }} size={9} ls="0.16em" color="#2F3E56">UDYOG VIHAR</Label>
      <Label style={{ bottom: '9%', left: '34%' }} size={9} ls="0.16em" color="#2F3E56">IGI AIRPORT</Label>
    </>
  )
}

function Label({
  children,
  style,
  size,
  ls,
  color,
}: {
  children: ReactNode
  style: CSSProperties
  size: number
  ls: string
  color: string
}) {
  return (
    <div className="mono" style={{ position: 'absolute', fontSize: size, letterSpacing: ls, color, ...style }}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pins & clusters                                                     */
/* ------------------------------------------------------------------ */
function Pin({ placed, selected, onClick }: { placed: Placed<User>; selected: boolean; onClick: () => void }) {
  const u = placed.item
  const color = designationColor(u.designation, u.category)
  const base: CSSProperties = {
    position: 'absolute',
    top: `${placed.pt.y}%`,
    left: `${placed.pt.x}%`,
    transform: 'translate(-50%,-50%)',
    cursor: 'pointer',
  }

  if (selected) {
    return (
      <div style={{ ...base, zIndex: 5 }} onClick={onClick}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: '50%', border: '1.5px solid #16C0AE', boxShadow: '0 0 22px rgba(22,192,174,0.4)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: color, boxShadow: `0 0 0 3px #04060B,0 0 14px ${color}` }} />
        <div style={{ position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: '#0E1626', border: '1px solid #16C0AE', borderRadius: 2, padding: '5px 10px', boxShadow: '0 8px 20px rgba(0,0,0,0.6)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#F0F4FA' }}>{u.fullName}</div>
          <div className="mono" style={{ fontSize: 9, color: '#5BC7BB', letterSpacing: '0.04em' }}>{coord(u.lastLocation)}</div>
          <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8, background: '#0E1626', borderRight: '1px solid #16C0AE', borderBottom: '1px solid #16C0AE' }} />
        </div>
      </div>
    )
  }

  if (u.online) {
    // online = solid designation dot with a live glow + soft pulse halo
    return (
      <div title={u.fullName} onClick={onClick} style={{ ...base, zIndex: 3 }}>
        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 26, height: 26, borderRadius: '50%', background: `${color}22`, animation: 'fon-pulse 2.4s infinite' }} />
        <span style={{ position: 'relative', display: 'block', width: 13, height: 13, borderRadius: '50%', background: color, boxShadow: `0 0 0 2px #04060B,0 0 10px ${color}80` }} />
      </div>
    )
  }

  // offline = hollow + muted, but tinted with the designation hue so the map
  // still reads as colour-coded operators; faint dashed last-seen ring.
  return (
    <div style={{ ...base, opacity: 0.9 }} onClick={onClick} title={u.fullName}>
      <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%', border: `1px dashed ${color}`, opacity: 0.28 }} />
      <span style={{ position: 'relative', display: 'block', width: 13, height: 13, borderRadius: '50%', background: '#0B1220', border: `2px solid ${color}`, boxShadow: '0 0 0 2px #04060B', opacity: 0.72 }} />
    </div>
  )
}

function ClusterBubble({ x, y, count, onClick }: { x: number; y: number; count: number; onClick: () => void }) {
  const size = Math.max(30, Math.min(26 + count * 2.5, 56))
  const strong = count >= 20
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        top: `${y}%`,
        left: `${x}%`,
        transform: 'translate(-50%,-50%)',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `rgba(22,192,174,${strong ? 0.14 : 0.12})`,
        border: `1.5px solid ${count >= 15 ? '#16C0AE' : '#0B7A6F'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: strong ? '0 0 24px rgba(22,192,174,0.15)' : undefined,
      }}
    >
      <span className="mono" style={{ fontSize: Math.max(12, Math.min(size / 3.4, 15)), fontWeight: 600, color: '#7BF0E2' }}>
        {count}
      </span>
      {strong && <span style={{ position: 'absolute', inset: -1.5, borderRadius: '50%', border: '1.5px solid #16C0AE', animation: 'fon-ring 3s infinite' }} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Counter strip                                                       */
/* ------------------------------------------------------------------ */
function CounterStrip({ counts }: { counts: { onboarded: number; online: number; offline: number } }) {
  return (
    <div style={{ position: 'absolute', top: 16, left: 'calc(50% - 170px)', transform: 'translateX(-50%)', display: 'flex', background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <Metric label="ONBOARDED" value={counts.onboarded} color="#F0F4FA" border />
      <Metric label="ONLINE" value={counts.online} color="#3FD07E" border dot />
      <Metric label="OFFLINE" value={counts.offline} color="#94A0B4" />
    </div>
  )
}
function Metric({ label, value, color, border, dot }: { label: string; value: number; color: string; border?: boolean; dot?: boolean }) {
  return (
    <div style={{ padding: '9px 20px', borderRight: border ? '1px solid #1E2A3D' : undefined, textAlign: 'center' }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: dot ? '#3FD07E' : '#5A6B84', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
        {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 6px #3FD07E' }} />}
        {label}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Filter panel                                                        */
/* ------------------------------------------------------------------ */
function FilterPanel(props: {
  presence: 'all' | 'online' | 'offline'
  setPresence: (p: 'all' | 'online' | 'offline') => void
  cats: Record<CategoryKey, boolean>
  setCats: Dispatch<SetStateAction<Record<CategoryKey, boolean>>>
  catCounts: Record<string, number>
  reset: () => void
  projects: Project[]
  projectId: string
  setProjectId: (id: string) => void
  projectOpen: boolean
  setProjectOpen: (o: boolean) => void
}) {
  const { presence, setPresence, cats, setCats, catCounts, reset, projects, projectId, setProjectId, projectOpen, setProjectOpen } = props
  const seg = (p: 'all' | 'online' | 'offline', last?: boolean) => (
    <div
      onClick={() => setPresence(p)}
      className="mono"
      style={{
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        letterSpacing: '0.05em',
        padding: '7px 0',
        cursor: 'pointer',
        borderRight: last ? undefined : '1px solid #1E2A3D',
        background: presence === p ? '#16C0AE' : 'transparent',
        color: presence === p ? '#04060B' : '#97A6BC',
        fontWeight: presence === p ? 600 : 400,
      }}
    >
      {p.toUpperCase()}
    </div>
  )
  const selectedProject = projects.find((p) => p._id === projectId)

  return (
    <div style={{ position: 'absolute', top: 16, left: 16, width: 250, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '10px 14px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>FILTERS</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#3DD5C6', cursor: 'pointer' }} onClick={reset}>RESET</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>PRESENCE</div>
        <div style={{ display: 'flex', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
          {seg('all')}
          {seg('online')}
          {seg('offline', true)}
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>DESIGNATION</div>
        <div style={{ marginBottom: 16 }}>
          {CATEGORY_ORDER.map((key) => {
            const on = cats[key]
            const color = CATEGORY_COLOR[key]
            return (
              <div
                key={key}
                className="rowh"
                onClick={() => setCats((s) => ({ ...s, [key]: !s[key] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 2, cursor: 'pointer', opacity: on ? 1 : 0.4 }}
              >
                <span style={{ width: 15, height: 15, flex: 'none', border: `1px solid ${color}`, borderRadius: 2, background: on ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#04060B', fontWeight: 700 }}>
                  {on ? '✓' : ''}
                </span>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} />
                <span style={{ fontSize: 12, color: '#C7D2E1', flex: 1 }}>{CATEGORY_LABEL[key]}</span>
                <span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>{catCounts[key] ?? 0}</span>
              </div>
            )
          })}
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>PROJECT</div>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setProjectOpen(!projectOpen)}
            style={{ fontSize: 12, color: '#C7D2E1', background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            {selectedProject ? selectedProject.name : 'All projects'}
            <span className="mono" style={{ color: '#5A6B84' }}>▾</span>
          </div>
          {projectOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, zIndex: 20, maxHeight: 200, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              <div className="rowh" onClick={() => { setProjectId(''); setProjectOpen(false) }} style={{ fontSize: 12, color: '#C7D2E1', padding: '8px 12px', cursor: 'pointer' }}>All projects</div>
              {projects.map((p) => (
                <div key={p._id} className="rowh" onClick={() => { setProjectId(p._id); setProjectOpen(false) }} style={{ fontSize: 12, color: '#C7D2E1', padding: '8px 12px', cursor: 'pointer' }}>
                  {p.name} <span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>· {p.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Legend                                                              */
/* ------------------------------------------------------------------ */
function Legend({ open, toggle }: { open: boolean; toggle: () => void }) {
  return (
    <div style={{ position: 'absolute', bottom: 16, left: 16, width: 250, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      <div onClick={toggle} className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '10px 14px', background: '#0E1626', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span>LEGEND · DESIGNATION</span>
        <span style={{ color: '#97A6BC' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #1E2A3D' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {CATEGORY_ORDER.map((key) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLOR[key] }} />
                <span style={{ fontSize: 11, color: '#C7D2E1', flex: 1 }}>{CATEGORY_LABEL[key]}</span>
                <span className="mono" style={{ fontSize: 9, color: '#5A6B84' }}>{CATEGORY_TAG[key]}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: '#1E2A3D', margin: '12px 0' }} />
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#4C8DFF', boxShadow: '0 0 0 2px #04060B' }} />
              <span style={{ fontSize: 10, color: '#97A6BC' }}>Online</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#0B1220', border: '2px solid #64748B' }} />
              <span style={{ fontSize: 10, color: '#97A6BC' }}>Offline</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ZoomControl({ onIn, onOut }: { onIn: () => void; onOut: () => void }) {
  const btn: CSSProperties = { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#97A6BC', cursor: 'pointer', fontSize: 15 }
  return (
    <div style={{ position: 'absolute', bottom: 16, left: 282, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      <div className="mono" style={{ ...btn, borderBottom: '1px solid #1E2A3D' }} onClick={onIn}>+</div>
      <div className="mono" style={btn} onClick={onOut}>−</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                       */
/* ------------------------------------------------------------------ */
function DetailDrawer({ user, detail, project, onClose }: { user: User; detail: Detail; project: Project | null; onClose: () => void }) {
  const color = designationColor(user.designation, user.category)
  const catColor = CATEGORY_COLOR[user.category]
  const firstSeen = detail.registration.createdAt ?? user.createdAt
  const pings = detail.locationHistory.slice(0, 3)
  const initials = user.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 340, background: '#0B1220', borderLeft: '1px solid #1E2A3D', boxShadow: '-18px 0 44px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 8 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '12px 18px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>OPERATOR DETAIL</span>
        <span onClick={onClose} style={{ color: '#97A6BC', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>×</span>
      </div>

      <div style={{ padding: '20px 18px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <span className="mono" style={{ fontSize: 18, fontWeight: 600, color }}>{initials}</span>
            <span style={{ position: 'absolute', bottom: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: user.online ? '#3FD07E' : '#64748B', border: '2px solid #0B1220', boxShadow: user.online ? '0 0 8px #3FD07E' : undefined }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#F0F4FA', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{user.fullName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: catColor }} />
              <span style={{ fontSize: 12, color: '#97A6BC' }}>{user.designation} · {user.category}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {user.online ? (
            <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.06em', color: '#3FD07E', border: '1px solid rgba(63,208,126,0.35)', borderRadius: 2, padding: '5px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 6px #3FD07E', animation: 'fon-pulse 1.6s infinite' }} />ONLINE
            </span>
          ) : (
            <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.06em', color: '#94A0B4', border: '1px solid #1E2A3D', borderRadius: 2, padding: '5px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748B' }} />OFFLINE
            </span>
          )}
          <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, letterSpacing: '0.06em', color: '#97A6BC', border: '1px solid #1E2A3D', borderRadius: 2, padding: '5px 10px' }}>
            SYNC {timeAgo(user.lastPingAt)} AGO
          </span>
        </div>

        <div style={{ border: '1px solid #1E2A3D', borderRadius: 2, marginBottom: 16 }}>
          <DrawerRow label="DEVICE ID" value={user.deviceId} valueColor="#3DD5C6" />
          <DrawerRow label="COORDINATES" value={coord(user.lastLocation)} />
          <DrawerRow label="FIRST SEEN" value={firstSeen ? new Date(firstSeen).toISOString().slice(0, 16).replace('T', ' ') : '—'} />
          <DrawerRow label="WORK EMAIL" value={user.workEmail} last />
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>ASSIGNED PROJECT</div>
        <div style={{ border: '1px solid #1E2A3D', borderLeft: '2px solid #16C0AE', borderRadius: 2, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EDF4' }}>{project ? project.name : 'No project assigned'}</div>
          {project && <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 4 }}>{project.code} · {project.memberIds.length} OPERATORS</div>}
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>PING LOG</div>
        <div style={{ border: '1px solid #1E2A3D', borderRadius: 2, padding: '10px 14px', marginBottom: 20 }}>
          {pings.length === 0 && <div className="mono" style={{ fontSize: 10, color: '#5A6B84', padding: '3px 0' }}>No pings recorded</div>}
          {pings.map((p, i) => (
            <div key={i} className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#97A6BC', padding: '3px 0' }}>
              <span>{clockOf(p.at)}</span>
              <span style={{ color: i === 0 ? '#3FD07E' : '#5A6B84' }}>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid #1E2A3D', background: '#0B1220', display: 'flex', gap: 10 }}>
        <button style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '11px 0', cursor: 'pointer' }}>View history</button>
        <button style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '11px 16px', cursor: 'pointer' }}>Message</button>
      </div>
    </div>
  )
}

function DrawerRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: last ? undefined : '1px solid #152134' }}>
      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#5A6B84' }}>{label}</span>
      <span className="mono" style={{ fontSize: 12, color: valueColor ?? '#C7D2E1' }}>{value}</span>
    </div>
  )
}
