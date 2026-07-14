import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AddMembersModal } from '../components/projects/AddMembersModal'
import { AiTaskModal, type Member } from '../components/projects/AiTaskModal'
import { useChrome } from '../components/shell/chrome'
import { type CategoryKey, designationColor } from '../data/designations'
import { PRIORITY, PROJECT_STATUS, TASK_COLUMNS, fmtDate } from '../data/projectMeta'
import { api } from '../lib/api'
import { initials } from '../lib/format'

type Project = {
  _id: string
  code: string
  name: string
  description: string
  priority: string
  startDate: string
  targetEndDate: string
  status: string
  memberIds: string[]
}
type MemberDoc = { id: string; fullName: string; designation: string; category: CategoryKey; online: boolean }
type Task = {
  _id: string
  title: string
  description: string
  assigneeId: string | null
  priority: string
  dueDate: string | null
  status: string
  source: string
}
type Detail = { project: Project; members: MemberDoc[]; tasks: Task[]; progress: number }

const POLL_MS = 10_000

export function ProjectDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const d = await api<Detail>(`/projects/${id}`)
    setDetail(d)
  }, [id])

  useEffect(() => {
    refresh().catch(() => {})
    const t = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  useChrome({ subtitle: detail ? `${detail.project.code} · DETAIL` : 'PROJECT · DETAIL', showSearch: false })

  const memberById = useMemo(() => new Map((detail?.members ?? []).map((m) => [m.id, m])), [detail])

  const counts = useMemo(() => {
    const c = { PENDING: 0, IN_PROGRESS: 0, BLOCKED: 0, COMPLETED: 0 } as Record<string, number>
    for (const t of detail?.tasks ?? []) if (t.status in c) c[t.status] += 1
    return c
  }, [detail])

  if (!detail) {
    return <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6B84', fontSize: 12 }}>LOADING PROJECT…</div>
  }

  const p = detail.project
  const prio = PRIORITY[p.priority] ?? PRIORITY.MEDIUM
  const st = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.PLANNING
  const endWarn = p.status !== 'COMPLETED' && new Date(p.targetEndDate).getTime() - Date.now() < 30 * 86_400_000
  const summary = `${counts.COMPLETED} DONE · ${counts.IN_PROGRESS} ACTIVE · ${counts.BLOCKED} BLOCKED · ${counts.PENDING} PENDING`
  const aiMembers: Member[] = detail.members.map((m) => ({ id: m.id, fullName: m.fullName, designation: m.designation, category: m.category }))

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ flex: 'none', padding: '16px 22px', borderBottom: '1px solid #1E2A3D', background: '#0B1220' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span onClick={() => navigate('/projects')} className="mono" style={{ fontSize: 11, color: '#3DD5C6', cursor: 'pointer', letterSpacing: '0.04em' }}>‹ PROJECTS</span>
          <span className="mono" style={{ fontSize: 11, color: '#3C4E6A' }}>/</span>
          <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>{p.name.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FA', letterSpacing: '-0.01em' }}>{p.name}</span>
            <span className="mono" style={{ fontSize: 9, letterSpacing: '0.06em', color: prio.color, border: `1px solid ${prio.border}`, borderRadius: 2, padding: '3px 8px' }}>{p.priority}</span>
            <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.05em', color: st.color, border: `1px solid ${st.color}59`, borderRadius: 2, padding: '3px 8px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />{st.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
            <button className="kbtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '9px 16px', cursor: 'pointer' }}>Edit project</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 14 }}>
          <Meta label="CODE" value={p.code} />
          <Meta label="START" value={fmtDate(p.startDate)} />
          <Meta label="TARGET END" value={fmtDate(p.targetEndDate)} color={endWarn ? '#FBBF3B' : '#C7D2E1'} />
          <Meta label="MEMBERS" value={String(p.memberIds.length)} />
          <Meta label="COMPLETION" value={`${detail.progress}%`} color="#5BC7BB" />
          <div style={{ flex: 1 }} />
          <div style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8, background: '#0E1626', border: '1px solid #1E2A3D', borderRadius: 2, padding: '6px 12px' }}><span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>{summary}</span></div>
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* members */}
        <div style={{ width: 300, flex: 'none', borderRight: '1px solid #1E2A3D', background: '#0B1220', display: 'flex', flexDirection: 'column' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '12px 16px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>MEMBERS · {detail.members.length}</span>
            <span onClick={() => setMembersOpen(true)} style={{ color: '#3DD5C6', cursor: 'pointer' }}>+ ADD</span>
          </div>
          <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {detail.members.length === 0 && <div className="mono" style={{ fontSize: 11, color: '#5A6B84', padding: 16 }}>No members yet</div>}
            {detail.members.map((m) => {
              const color = designationColor(m.designation, m.category)
              return (
                <div key={m.id} className="rowh" onClick={() => navigate(`/users/${m.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderBottom: '1px solid #10192A', cursor: 'pointer' }}>
                  <span className="mono" style={{ width: 30, height: 30, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color, position: 'relative' }}>{initials(m.fullName)}{m.online && <span style={{ position: 'absolute', bottom: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: '#3FD07E', border: '1.5px solid #0B1220' }} />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#E8EDF4', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fullName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} /><span className="mono" style={{ fontSize: 10, color: '#7C89A1' }}>{m.designation}</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* task board */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#070911' }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #1E2A3D', background: '#0B1220' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', color: '#97A6BC' }}>TASK BOARD</span>
              <div style={{ display: 'flex', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden' }}>
                <span className="mono" style={{ fontSize: 10, padding: '6px 12px', background: '#152134', color: '#E8EDF4' }}>BOARD</span>
                <span className="mono kbtn" style={{ fontSize: 10, padding: '6px 12px', color: '#5A6B84', cursor: 'pointer', borderLeft: '1px solid #1E2A3D' }}>TABLE</span>
              </div>
            </div>
            <button onClick={() => setAiOpen(true)} className="aibtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="#04060B"><path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11 6.7 7.3 3 6l3.7-1.3z" /><path d="M13 10l.7 1.8L15.5 12.5 13.7 13.2 13 15l-.7-1.8L10.5 12.5 12.3 11.8z" /></svg>
              Generate Tasks with AI
            </button>
          </div>

          {banner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: 'rgba(22,192,174,0.08)', borderBottom: '1px solid #16C0AE' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="#16C0AE"><path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11 6.7 7.3 3 6l3.7-1.3z" /></svg>
              <span className="mono" style={{ fontSize: 11, color: '#7BF0E2' }}>{banner}</span>
              <div style={{ flex: 1 }} />
              <span onClick={() => setBanner(null)} className="mono" style={{ fontSize: 10, color: '#3DD5C6', cursor: 'pointer' }}>DISMISS</span>
            </div>
          )}

          <div className="colscroll" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '14px 18px', overflowY: 'auto' }}>
            {TASK_COLUMNS.map((col) => {
              const cards = detail.tasks.filter((t) => t.status === col.key)
              return (
                <div key={col.key} style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: `2px solid ${col.color}`, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#C7D2E1' }}>{col.name}</span>
                    <span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>{cards.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cards.map((t) => {
                      const who = t.assigneeId ? memberById.get(t.assigneeId) : undefined
                      const color = who ? designationColor(who.designation, who.category) : '#4C8DFF'
                      return (
                        <div key={t._id} className="rowh" style={{ background: '#0B1220', border: '1px solid #1E2A3D', borderLeft: `2px solid ${col.color}`, borderRadius: 2, padding: '11px 12px', cursor: 'pointer' }}>
                          <div style={{ fontSize: 12, color: '#E8EDF4', lineHeight: 1.35, marginBottom: 9 }}>{t.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="mono" style={{ width: 22, height: 22, borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color }}>{initials(who?.fullName)}</span>
                            {t.source?.includes('ai') && <span className="mono" style={{ fontSize: 8, letterSpacing: '0.06em', color: '#5BC7BB', border: '1px solid rgba(22,192,174,0.3)', borderRadius: 2, padding: '2px 6px' }}>AI-GEN</span>}
                          </div>
                        </div>
                      )
                    })}
                    {cards.length === 0 && <div className="mono" style={{ fontSize: 10, color: '#3C4E6A', padding: '8px 2px' }}>—</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {membersOpen && (
        <AddMembersModal
          projectId={p._id}
          projectName={p.name}
          projectCode={p.code}
          existingMemberIds={p.memberIds}
          onClose={() => setMembersOpen(false)}
          onAdded={() => refresh().catch(() => {})}
        />
      )}
      {aiOpen && (
        <AiTaskModal
          projectId={p._id}
          projectName={p.name}
          projectCode={p.code}
          description={p.description}
          startDate={p.startDate}
          targetEndDate={p.targetEndDate}
          members={aiMembers}
          onClose={() => setAiOpen(false)}
          onCommitted={(n) => {
            setAiOpen(false)
            setBanner(`AI drafted and assigned ${n} task${n === 1 ? '' : 's'} · review on the board`)
            refresh().catch(() => {})
          }}
        />
      )}
    </div>
  )
}

function Meta({ label, value, color = '#C7D2E1' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: '0.08em', color: '#5A6B84', marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12, color }}>{value}</div>
    </div>
  )
}
