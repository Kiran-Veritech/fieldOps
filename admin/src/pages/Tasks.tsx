import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChrome } from '../components/shell/chrome'
import { type CategoryKey, designationColor } from '../data/designations'
import { PRIORITY, fmtDate } from '../data/projectMeta'
import { api } from '../lib/api'
import { initials } from '../lib/format'

type Task = {
  _id: string
  projectId: string
  title: string
  description: string
  assigneeId: string | null
  priority: string
  dueDate: string | null
  status: string
  blockedReason: string | null
  source: string
}
type Project = { _id: string; name: string; code: string }
type User = { id: string; fullName: string; designation: string; category: CategoryKey }

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'PENDING', color: '#F4A521' },
  IN_PROGRESS: { label: 'IN PROGRESS', color: '#3B82F6' },
  BLOCKED: { label: 'BLOCKED', color: '#F04438' },
  COMPLETED: { label: 'COMPLETED', color: '#3FD07E' },
}
const GRID = '2fr 150px 170px 92px 92px 120px'
const POLL_MS = 10_000
type Filter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED'

export function Tasks() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')

  const refresh = useCallback(async () => {
    const [t, p, u] = await Promise.all([
      api<Task[]>('/tasks'),
      api<Project[]>('/projects'),
      api<{ items: User[] }>('/users?pageSize=200'),
    ])
    setTasks(t)
    setProjects(p)
    setUsers(u.items)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
    const t = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  useChrome({ subtitle: `ALL TASKS · ${tasks.length}`, showSearch: false })

  const projectById = useMemo(() => new Map(projects.map((p) => [p._id, p])), [projects])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tasks.length, PENDING: 0, IN_PROGRESS: 0, BLOCKED: 0, COMPLETED: 0 }
    for (const t of tasks) if (t.status in c) c[t.status] += 1
    return c
  }, [tasks])

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return tasks.filter((t) => {
      if (filter !== 'ALL' && t.status !== filter) return false
      if (query) {
        const proj = projectById.get(t.projectId)
        if (!`${t.title} ${t.description} ${proj?.name ?? ''}`.toLowerCase().includes(query)) return false
      }
      return true
    })
  }, [tasks, filter, q, projectById])

  const segs: { key: Filter; label: string }[] = [
    { key: 'ALL', label: `ALL ${counts.ALL}` },
    { key: 'PENDING', label: `PENDING ${counts.PENDING}` },
    { key: 'IN_PROGRESS', label: `IN PROGRESS ${counts.IN_PROGRESS}` },
    { key: 'BLOCKED', label: `BLOCKED ${counts.BLOCKED}` },
    { key: 'COMPLETED', label: `DONE ${counts.COMPLETED}` },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* toolbar */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #1E2A3D', background: '#070911' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', width: 280 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5A6B84" strokeWidth={1.5}><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or projects…" style={{ fontFamily: 'inherit', fontSize: 12, color: '#C7D2E1', background: 'transparent', border: 'none', outline: 'none', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden' }}>
          {segs.map((s, i) => {
            const active = filter === s.key
            return <span key={s.key} onClick={() => setFilter(s.key)} className="mono" style={{ fontSize: 10, letterSpacing: '0.05em', padding: '9px 13px', cursor: 'pointer', borderLeft: i > 0 ? '1px solid #1E2A3D' : undefined, background: active ? '#16C0AE' : 'transparent', color: active ? '#04060B' : '#97A6BC', fontWeight: active ? 600 : 400 }}>{s.label}</span>
          })}
        </div>
      </div>

      {/* table */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#04060B' }}>
        <div className="mono" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '10px 18px', background: '#0E1626', borderBottom: '1px solid #1E2A3D', fontSize: 9, letterSpacing: '0.09em', color: '#5A6B84' }}>
          <span>TASK</span><span>PROJECT</span><span>ASSIGNEE</span><span>PRIORITY</span><span>DUE</span><span>STATUS</span>
        </div>
        <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {rows.length === 0 && <div className="mono" style={{ fontSize: 11, color: '#3C4E6A', padding: 20, letterSpacing: '0.08em' }}>NO MATCHING TASKS</div>}
          {rows.map((t) => {
            const proj = projectById.get(t.projectId)
            const who = t.assigneeId ? userById.get(t.assigneeId) : undefined
            const aColor = who ? designationColor(who.designation, who.category) : '#4C8DFF'
            const pm = PRIORITY[t.priority] ?? PRIORITY.MEDIUM
            const sm = STATUS_META[t.status] ?? { label: t.status, color: '#97A6BC' }
            return (
              <div key={t._id} className="rowh" onClick={() => proj && navigate(`/projects/${proj._id}`)} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #10192A', cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#E8EDF4', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    {t.source?.includes('ai') && <span className="mono" style={{ flex: 'none', fontSize: 8, letterSpacing: '0.06em', color: '#5BC7BB', border: '1px solid rgba(22,192,174,0.3)', borderRadius: 2, padding: '1px 5px' }}>AI-GEN</span>}
                  </div>
                  <div style={{ fontSize: 11, color: t.status === 'BLOCKED' && t.blockedReason ? '#FF8F94' : '#7C89A1', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.status === 'BLOCKED' && t.blockedReason ? `Blocked: ${t.blockedReason}` : t.description}</div>
                </div>
                <span style={{ fontSize: 12, color: '#C7D2E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj?.name ?? '—'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className="mono" style={{ width: 22, height: 22, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${aColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: aColor }}>{initials(who?.fullName)}</span>
                  <span style={{ fontSize: 12, color: '#97A6BC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who?.fullName ?? 'Unassigned'}</span>
                </span>
                <span className="mono" style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9, letterSpacing: '0.05em', color: pm.color, border: `1px solid ${pm.border}`, borderRadius: 2, padding: '3px 8px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: pm.color }} />{t.priority}</span>
                <span className="mono" style={{ fontSize: 11, color: '#C7D2E1' }}>{fmtDate(t.dueDate)}</span>
                <span className="mono" style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9, letterSpacing: '0.05em', color: sm.color, borderLeft: `2px solid ${sm.color}`, background: `${sm.color}1f`, borderRadius: 2, padding: '4px 8px' }}>{sm.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
