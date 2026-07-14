import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChrome } from '../components/shell/chrome'
import { designationColor } from '../data/designations'
import { api } from '../lib/api'
import { clockOf, initials, timeAgo } from '../lib/format'

type Summary = {
  counts: { onboarded: number; online: number; offline: number; pendingApprovals: number; activeProjects: number }
  recentPings: { userId: string; fullName: string; designation: string; category: string; at: string }[]
  needsAttention: {
    pendingApprovals: number
    offlineOverAnHour: { id: string; fullName: string; designation: string; lastPingAt: string | null }[]
    blockedTasks: { id: string; title: string; projectId: string; blockedReason: string | null }[]
  }
  series24h: { hour: string; online: number; offline: number }[]
}
type User = { id: string; fullName: string; createdAt: string | null }
type Project = { _id: string; name: string }
type Asset = { _id: string; name: string; serialNumber: string; ownerId: string; createdAt: string }

const POLL_MS = 10_000

export function Dashboard() {
  useChrome({ subtitle: 'GURUGRAM · DELHI NCR · SHIFT A', showSearch: true })

  const [summary, setSummary] = useState<Summary | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [pending, setPending] = useState<Asset[]>([])

  const refresh = useCallback(async () => {
    const [s, u, p, a] = await Promise.all([
      api<Summary>('/dashboard/summary'),
      api<{ items: User[] }>('/users?pageSize=200'),
      api<Project[]>('/projects'),
      api<Asset[]>('/assets?status=pending'),
    ])
    setSummary(s)
    setUsers(u.items)
    setProjects(p)
    setPending(a)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
    const id = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const nameById = useMemo(() => new Map(users.map((u) => [u.id, u.fullName])), [users])
  const projById = useMemo(() => new Map(projects.map((p) => [p._id, p.name])), [projects])

  if (!summary) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#5A6B84' }}>LOADING DASHBOARD…</span>
      </div>
    )
  }

  const c = summary.counts
  const onlinePct = c.onboarded ? Math.round((c.online / c.onboarded) * 100) : 0
  const newToday = users.filter((u) => u.createdAt && Date.now() - new Date(u.createdAt).getTime() < 86_400_000).length
  const offlineOverHour = summary.needsAttention.offlineOverAnHour.length
  const attentionTotal = c.pendingApprovals + offlineOverHour + summary.needsAttention.blockedTasks.length

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, flex: 'none' }}>
        <MetricCard label="ONBOARDED USERS" value={c.onboarded} valueColor="#F0F4FA" sub={`▲ +${newToday} TODAY`} subColor="#5BE59A" />
        <MetricCard label="ONLINE NOW" value={c.online} valueColor="#3FD07E" labelColor="#3FD07E" leftBar="#3FD07E" dot sub={`${onlinePct}% OF ONBOARDED`} subColor="#5A6B84" />
        <MetricCard label="OFFLINE" value={c.offline} valueColor="#94A0B4" grayDot sub={`${offlineOverHour} OVER 1H`} subColor="#5A6B84" />
        <MetricCard label="PENDING APPROVALS" value={c.pendingApprovals} valueColor="#FBBF3B" labelColor="#FBBF3B" leftBar="#F4A521" sub="ASSETS AWAITING REVIEW" subColor="#5A6B84" />
        <MetricCard label="ACTIVE PROJECTS" value={c.activeProjects} valueColor="#F0F4FA" sub="IN FLIGHT NOW" subColor="#7BF0E2" />
      </div>

      {/* TWO-COLUMN GRID */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 14 }}>
        {/* LEFT */}
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TrendChart series={summary.series24h} online={c.online} offline={c.offline} maxCount={c.onboarded || 1} />
          <RecentActivity feed={summary.recentPings} />
        </div>

        {/* RIGHT */}
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MapPreview online={c.online} offline={c.offline} />
          <NeedsAttention
            total={attentionTotal}
            pendingCount={c.pendingApprovals}
            pending={pending}
            nameById={nameById}
            offline={summary.needsAttention.offlineOverAnHour}
            blocked={summary.needsAttention.blockedTasks}
            projById={projById}
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function MetricCard({
  label, value, valueColor, labelColor = '#5A6B84', sub, subColor, leftBar, dot, grayDot,
}: {
  label: string; value: number; valueColor: string; labelColor?: string; sub: string; subColor: string; leftBar?: string; dot?: boolean; grayDot?: boolean
}) {
  return (
    <div style={{ background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '14px 16px', position: 'relative' }}>
      {leftBar && <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 2, background: leftBar }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: labelColor, display: 'flex', alignItems: 'center', gap: 6 }}>
          {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 7px #3FD07E', animation: 'fon-pulse 1.6s infinite' }} />}
          {grayDot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748B' }} />}
          {label}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: valueColor, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      <div className="mono" style={{ fontSize: 10, color: subColor, marginTop: 9 }}>{sub}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function PanelHead({ children }: { children: ReactNode }) {
  return (
    <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '10px 16px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {children}
    </div>
  )
}

function TrendChart({ series, online, offline, maxCount }: { series: Summary['series24h']; online: number; offline: number; maxCount: number }) {
  const N = Math.max(series.length, 2)
  const x = (i: number) => 20 + (560 * i) / (N - 1)
  const y = (v: number) => 140 - (v / maxCount) * 120
  const onPts = series.map((s, i) => `${x(i).toFixed(0)},${y(s.online).toFixed(0)}`).join(' ')
  const offPts = series.map((s, i) => `${x(i).toFixed(0)},${y(s.offline).toFixed(0)}`).join(' ')
  const areaPts = `20,140 ${onPts} ${x(N - 1).toFixed(0)},140`
  const last = series[series.length - 1] ?? { online: 0, offline: 0 }

  return (
    <div style={{ flex: 'none', background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
      <PanelHead>
        <span>ONLINE / OFFLINE · LAST 24H</span>
        <span style={{ display: 'flex', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3FD07E' }}><span style={{ width: 8, height: 2, background: '#3FD07E' }} />ONLINE {online}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A0B4' }}><span style={{ width: 8, height: 2, background: '#64748B' }} />OFFLINE {offline}</span>
        </span>
      </PanelHead>
      <div style={{ padding: '14px 16px 8px' }}>
        <svg width="100%" height="168" viewBox="0 0 600 168" preserveAspectRatio="none" style={{ display: 'block' }}>
          {[20, 60, 100].map((yy) => <line key={yy} x1="20" y1={yy} x2="600" y2={yy} stroke="#152134" strokeWidth="1" />)}
          <line x1="20" y1="140" x2="600" y2="140" stroke="#1E2A3D" strokeWidth="1" />
          <polygon points={areaPts} fill="rgba(63,208,126,0.10)" />
          <polyline points={offPts} fill="none" stroke="#64748B" strokeWidth="1.6" />
          <polyline points={onPts} fill="none" stroke="#3FD07E" strokeWidth="1.8" />
          <circle cx={x(N - 1)} cy={y(last.online)} r="3.5" fill="#3FD07E" />
          <circle cx={x(N - 1)} cy={y(last.offline)} r="3" fill="#64748B" />
        </svg>
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#3C4E6A', padding: '0 4px 4px 20px', letterSpacing: '0.08em' }}>
          {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'].map((t) => <span key={t}>{t}</span>)}
        </div>
      </div>
    </div>
  )
}

function RecentActivity({ feed }: { feed: Summary['recentPings'] }) {
  return (
    <div style={{ flex: 1, minHeight: 0, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
      <PanelHead>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 7px #3FD07E', animation: 'fon-pulse 1.6s infinite' }} />RECENT SYNC ACTIVITY</span>
        <span style={{ color: '#3C4E6A' }}>LIVE · PING 10s</span>
      </PanelHead>
      <div className="feedscroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {feed.length === 0 && <div className="mono" style={{ fontSize: 11, color: '#5A6B84', padding: '16px' }}>No recent pings.</div>}
        {feed.map((p, i) => {
          const color = designationColor(p.designation, p.category)
          return (
            <div key={`${p.userId}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #10192A' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <span className="mono" style={{ width: 28, height: 28, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color }}>{initials(p.fullName)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#E8EDF4', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.fullName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} /><span style={{ fontSize: 11, color: '#7C89A1' }}>{p.designation}</span></div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 11, color: '#5BC7BB' }}>{timeAgo(p.at)} ago</div>
                <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 2 }}>{clockOf(p.at)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MapPreview({ online, offline }: { online: number; offline: number }) {
  return (
    <Link to="/live-map" style={{ flex: 'none', textDecoration: 'none', background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden', display: 'block' }}>
      <PanelHead><span>LIVE MAP</span><span style={{ color: '#3DD5C6' }}>OPEN FULL ›</span></PanelHead>
      <div style={{ position: 'relative', height: 186, background: '#070C16', backgroundImage: 'linear-gradient(rgba(120,150,190,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(120,150,190,0.05) 1px,transparent 1px)', backgroundSize: '26px 26px' }}>
        <div style={{ position: 'absolute', top: 0, left: '40%', width: 2, height: '100%', background: 'rgba(120,150,190,0.08)', transform: 'rotate(12deg)' }} />
        <div style={{ position: 'absolute', top: '52%', left: 0, width: '100%', height: 2, background: 'rgba(120,150,190,0.08)', transform: 'rotate(-6deg)' }} />
        <div className="mono" style={{ position: 'absolute', top: 12, right: 14, fontSize: 9, letterSpacing: '0.2em', color: '#2F3E56' }}>GURUGRAM</div>
        <div style={{ position: 'absolute', top: '30%', left: '30%', width: 38, height: 38, borderRadius: '50%', background: 'rgba(22,192,174,0.14)', border: '1.5px solid #16C0AE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="mono" style={{ fontSize: 12, fontWeight: 600, color: '#7BF0E2' }}>{online}</span></div>
        <div style={{ position: 'absolute', top: '60%', left: '55%', width: 30, height: 30, borderRadius: '50%', background: 'rgba(22,192,174,0.12)', border: '1.5px solid #16C0AE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="mono" style={{ fontSize: 11, fontWeight: 600, color: '#7BF0E2' }}>{offline}</span></div>
        <div style={{ position: 'absolute', top: '22%', left: '62%', width: 11, height: 11, borderRadius: '50%', background: '#2E6BF0', boxShadow: '0 0 0 2px #04060B,0 0 8px rgba(46,107,240,0.5)' }} />
        <div style={{ position: 'absolute', top: '70%', left: '26%', width: 11, height: 11, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 0 2px #04060B,0 0 8px rgba(245,158,11,0.5)' }} />
        <div style={{ position: 'absolute', top: '44%', left: '72%', width: 11, height: 11, borderRadius: '50%', background: '#C084FC', boxShadow: '0 0 0 2px #04060B,0 0 8px rgba(192,132,252,0.5)' }} />
        <div style={{ position: 'absolute', top: '80%', left: '68%', width: 11, height: 11, borderRadius: '50%', background: '#0B1220', border: '2px solid #64748B', boxShadow: '0 0 0 2px #04060B', opacity: 0.8 }} />
      </div>
    </Link>
  )
}

function NeedsAttention({
  total, pendingCount, pending, nameById, offline, blocked, projById,
}: {
  total: number
  pendingCount: number
  pending: Asset[]
  nameById: Map<string, string>
  offline: Summary['needsAttention']['offlineOverAnHour']
  blocked: Summary['needsAttention']['blockedTasks']
  projById: Map<string, string>
}) {
  const shortName = (full: string | undefined) => {
    if (!full) return '—'
    const parts = full.split(/\s+/)
    return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : full
  }
  return (
    <div style={{ flex: 1, minHeight: 0, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
      <PanelHead>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F4A521', boxShadow: '0 0 7px #F4A521' }} />NEEDS ATTENTION</span>
        <span style={{ color: '#FBBF3B' }}>{total}</span>
      </PanelHead>
      <div className="nascroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <SectionHead label="PENDING ASSET APPROVALS" count={pendingCount} countColor="#FBBF3B" first />
        {pending.map((a) => (
          <div key={a._id} className="rowh" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderLeft: '2px solid #F4A521', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: '#E8EDF4' }}>{a.name}</div><div className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>{a.serialNumber} · {shortName(nameById.get(a.ownerId))}</div></div>
            <span className="mono" style={{ fontSize: 10, color: '#7C89A1' }}>{timeAgo(a.createdAt)}</span>
          </div>
        ))}

        <SectionHead label="OFFLINE > 1 HOUR" count={offline.length} countColor="#94A0B4" />
        {offline.map((u) => (
          <div key={u.id} className="rowh" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderLeft: '2px solid #64748B', cursor: 'pointer' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0B1220', border: '2px solid #64748B', flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: '#E8EDF4' }}>{u.fullName}</div><div className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>{u.designation}</div></div>
            <span className="mono" style={{ fontSize: 10, color: '#FF8F94' }}>{timeAgo(u.lastPingAt)}</span>
          </div>
        ))}

        <SectionHead label="BLOCKED TASKS" count={blocked.length} countColor="#FF8F94" />
        {blocked.map((t) => (
          <div key={t.id} className="rowh" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderLeft: '2px solid #F04438', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: '#E8EDF4' }}>{t.title}</div><div className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>{projById.get(t.projectId) ?? '—'}</div></div>
            <span className="mono" style={{ fontSize: 10, color: '#FF8F94' }}>BLOCKED</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionHead({ label, count, countColor, first }: { label: string; count: number; countColor: string; first?: boolean }) {
  return (
    <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', padding: first ? '9px 16px 6px' : '11px 16px 6px', borderTop: first ? undefined : '1px solid #10192A', display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span><span style={{ color: countColor }}>{count}</span>
    </div>
  )
}
