import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChrome } from '../components/shell/chrome'
import { type CategoryKey, designationColor } from '../data/designations'
import { PRIORITY, PRIORITY_ORDER, PROJECT_STATUS, fmtDate } from '../data/projectMeta'
import { api } from '../lib/api'
import { initials } from '../lib/format'

type Project = {
  _id: string
  code: string
  name: string
  priority: string
  startDate: string
  targetEndDate: string
  status: string
  memberIds: string[]
}
type User = { id: string; fullName: string; designation: string; category: CategoryKey }
type Task = { projectId: string; status: string }

const POLL_MS = 10_000
type StatusFilter = 'ALL' | 'ACTIVE' | 'AT_RISK' | 'COMPLETED'
type SortKey = 'Priority' | 'Name' | 'Progress'

export function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [sort, setSort] = useState<SortKey>('Priority')

  const refresh = useCallback(async () => {
    const [p, u, t] = await Promise.all([
      api<Project[]>('/projects'),
      api<{ items: User[] }>('/users?pageSize=200'),
      api<Task[]>('/tasks'),
    ])
    setProjects(p)
    setUsers(u.items)
    setTasks(t)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
    const id = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useChrome({ subtitle: `PORTFOLIO · ${projects.length} PROJECTS`, showSearch: false })

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const taskStats = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>()
    for (const t of tasks) {
      const s = m.get(t.projectId) ?? { done: 0, total: 0 }
      s.total += 1
      if (t.status === 'COMPLETED') s.done += 1
      m.set(t.projectId, s)
    }
    return m
  }, [tasks])

  const counts = useMemo(() => ({
    ALL: projects.length,
    ACTIVE: projects.filter((p) => p.status === 'ACTIVE').length,
    AT_RISK: projects.filter((p) => p.status === 'AT_RISK').length,
    COMPLETED: projects.filter((p) => p.status === 'COMPLETED').length,
  }), [projects])

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase()
    let out = projects
    if (query) out = out.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
    if (filter !== 'ALL') out = out.filter((p) => p.status === filter)
    return [...out].sort((a, b) => {
      if (sort === 'Name') return a.name.localeCompare(b.name)
      if (sort === 'Progress') return progressOf(b) - progressOf(a)
      return PRIORITY_ORDER.indexOf(a.priority as never) - PRIORITY_ORDER.indexOf(b.priority as never)
    })
    function progressOf(p: Project) {
      const s = taskStats.get(p._id)
      return s && s.total ? (s.done / s.total) * 100 : 0
    }
  }, [projects, q, filter, sort, taskStats])

  const segs: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: `ALL ${counts.ALL}` },
    { key: 'ACTIVE', label: 'ACTIVE' },
    { key: 'AT_RISK', label: 'AT RISK' },
    { key: 'COMPLETED', label: 'DONE' },
  ]

  return (
    <div className="scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
      <div style={{ padding: 18 }}>
        {/* toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', width: 280 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5A6B84" strokeWidth={1.5}><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" style={{ fontFamily: 'inherit', fontSize: 12, color: '#C7D2E1', background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden' }}>
            {segs.map((s, i) => (
              <span key={s.key} onClick={() => setFilter(s.key)} className="mono" style={{ fontSize: 10, letterSpacing: '0.05em', padding: '9px 14px', cursor: 'pointer', borderLeft: i > 0 ? '1px solid #1E2A3D' : undefined, background: filter === s.key ? '#16C0AE' : 'transparent', color: filter === s.key ? '#04060B' : '#97A6BC', fontWeight: filter === s.key ? 600 : 400 }}>{s.label}</span>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div className="mono kbtn" onClick={() => setSort((s) => (s === 'Priority' ? 'Name' : s === 'Name' ? 'Progress' : 'Priority'))} style={{ fontSize: 11, color: '#97A6BC', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', cursor: 'pointer' }}>Sort: {sort} ▾</div>
          <button style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '9px 16px', cursor: 'pointer' }}>+ New project</button>
        </div>

        {visible.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: '80px 0' }}>
            <span style={{ fontSize: 15, color: '#97A6BC' }}>No projects</span>
            <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>ADJUST FILTERS OR CREATE ONE</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {visible.map((p) => {
              const stats = taskStats.get(p._id) ?? { done: 0, total: 0 }
              const progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0
              const prio = PRIORITY[p.priority] ?? PRIORITY.MEDIUM
              const st = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.PLANNING
              const progColor = progress >= 100 ? '#3FD07E' : '#16C0AE'
              const endWarn = p.status !== 'COMPLETED' && new Date(p.targetEndDate).getTime() - Date.now() < 30 * 86_400_000
              const avatars = p.memberIds.slice(0, 4)
              const more = p.memberIds.length - avatars.length
              return (
                <div key={p._id} className="pcard" onClick={() => navigate(`/projects/${p._id}`)} style={{ background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '16px 18px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 2, background: st.color }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F4FA', lineHeight: 1.25 }}>{p.name}</div>
                      <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 5 }}>{p.code}</div>
                    </div>
                    <span className="mono" style={{ flex: 'none', fontSize: 9, letterSpacing: '0.06em', color: prio.color, border: `1px solid ${prio.border}`, borderRadius: 2, padding: '3px 8px' }}>{p.priority}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                    <div><div className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: '#5A6B84', marginBottom: 4 }}>START</div><div className="mono" style={{ fontSize: 12, color: '#C7D2E1' }}>{fmtDate(p.startDate)}</div></div>
                    <div><div className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: '#5A6B84', marginBottom: 4 }}>TARGET END</div><div className="mono" style={{ fontSize: 12, color: endWarn ? '#FBBF3B' : '#C7D2E1' }}>{fmtDate(p.targetEndDate)}</div></div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><span className="mono" style={{ fontSize: 10, color: '#5A6B84', letterSpacing: '0.06em' }}>TASKS {stats.done}/{stats.total}</span><span className="mono" style={{ fontSize: 11, color: progColor, fontWeight: 600 }}>{progress}%</span></div>
                    <div style={{ height: 5, background: '#152134', overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: progColor }} /></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {avatars.map((mid, j) => {
                        const u = userById.get(mid)
                        const color = u ? designationColor(u.designation, u.category) : '#4C8DFF'
                        return <span key={mid} className="mono" style={{ width: 26, height: 26, borderRadius: '50%', background: '#152134', border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color, marginLeft: j === 0 ? 0 : -8, boxShadow: '0 0 0 2px #0B1220' }}>{initials(u?.fullName)}</span>
                      })}
                      {more > 0 && <span className="mono" style={{ fontSize: 11, color: '#7C89A1', marginLeft: 8 }}>+{more}</span>}
                    </div>
                    <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.05em', color: st.color }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />{st.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
