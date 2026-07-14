import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { type CategoryKey, designationColor } from '../../data/designations'
import { PRIORITY, PRIORITY_ORDER, fmtDate, weeksBetween } from '../../data/projectMeta'
import { api, ApiError } from '../../lib/api'
import { initials } from '../../lib/format'

export type Member = {
  id: string
  fullName: string
  designation: string
  category: CategoryKey
}
type Draft = {
  title: string
  description: string
  suggestedAssigneeId: string | null
  priority: string
  dueDate: string | null
}
type Row = {
  id: number
  title: string
  description: string
  assigneeId: string | null
  priority: string
  due: string
  edited: boolean
}

// Team-composition chip styling per category (design tokens).
const CHIP: Record<CategoryKey, { label: string; color: string; border: string }> = {
  Engineering: { label: 'ENGINEERING', color: '#7DB0FF', border: 'rgba(59,130,246,0.3)' },
  Delivery: { label: 'DELIVERY', color: '#F4C77A', border: 'rgba(245,158,11,0.3)' },
  Quality: { label: 'QUALITY', color: '#C084FC', border: 'rgba(168,85,247,0.3)' },
  Operations: { label: 'OPS', color: '#5BC7BB', border: 'rgba(6,182,212,0.3)' },
  Business: { label: 'BUSINESS', color: '#FB9AA8', border: 'rgba(251,113,133,0.3)' },
}
const STATUS_LOG = ['Analysed project scope & objectives', 'Mapped members to task skills', 'Sequencing & assigning tasks…']

export function AiTaskModal({
  projectId, projectName, projectCode, description, startDate, targetEndDate, members, onClose, onCommitted,
}: {
  projectId: string
  projectName: string
  projectCode: string
  description: string
  startDate: string
  targetEndDate: string
  members: Member[]
  onClose: () => void
  onCommitted: (n: number) => void
}) {
  const weeks = weeksBetween(startDate, targetEndDate)
  const [step, setStep] = useState<'trigger' | 'generating' | 'review' | 'error'>('trigger')
  const [objectives, setObjectives] = useState<string[]>([
    `Complete core scope for ${projectName}`,
    'Pass QA on all field deliverables',
    'Deliver as-built handover documentation',
  ])
  const [errMsg, setErrMsg] = useState('')
  const [gen, setGen] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [menu, setMenu] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const draftRef = useRef<Draft[] | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current) }, [])

  const composition = useMemo(() => {
    const m = new Map<CategoryKey, number>()
    for (const mem of members) m.set(mem.category, (m.get(mem.category) ?? 0) + 1)
    return m
  }, [members])

  const setObjective = (i: number, v: string) => setObjectives((o) => o.map((x, j) => (j === i ? v : x)))
  const addObjective = () => setObjectives((o) => [...o, ''])
  const removeObjective = (i: number) => setObjectives((o) => o.filter((_, j) => j !== i))

  const generate = () => {
    setStep('generating')
    setGen(0)
    draftRef.current = null
    const timeline = `${fmtDate(startDate)} → ${fmtDate(targetEndDate)} (${weeks} weeks)`
    api<{ draft: Draft[] }>(`/projects/${projectId}/generate-tasks`, {
      method: 'POST',
      body: { objectives: objectives.map((o) => o.trim()).filter(Boolean), timeline },
    })
      .then((res) => { draftRef.current = res.draft })
      .catch((e) => {
        if (tickRef.current) clearInterval(tickRef.current)
        const msg = e instanceof ApiError && (e.body as { detail?: { error?: { message?: string } } })?.detail?.error?.message
        setErrMsg(msg || 'The AI service did not respond. Nothing was saved — try again.')
        setStep('error')
      })

    tickRef.current = setInterval(() => {
      setGen((g) => {
        const draft = draftRef.current
        const cap = draft ? draft.length : 8 // hold below total until draft lands
        const next = Math.min(g + 1, draft ? draft.length : cap)
        if (draft && next >= draft.length) {
          if (tickRef.current) clearInterval(tickRef.current)
          setTimeout(() => finishToReview(draft), 320)
        }
        return next
      })
    }, 200)
  }

  const finishToReview = (draft: Draft[]) => {
    const fallback = members[0]?.id ?? null
    setRows(draft.map((d, i) => ({
      id: i,
      title: d.title,
      description: d.description,
      assigneeId: d.suggestedAssigneeId ?? fallback,
      priority: PRIORITY[d.priority] ? d.priority : 'MEDIUM',
      due: d.dueDate ? fmtDate(d.dueDate) : '',
      edited: false,
    })))
    setStep('review')
  }

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, edited: true } : r)))

  const commit = async () => {
    if (rows.length === 0) return
    setSaving(true)
    try {
      const tasks = rows.map((r) => {
        const parsed = r.due ? new Date(r.due) : null
        return {
          title: r.title,
          description: r.description,
          assigneeId: r.assigneeId,
          priority: r.priority,
          dueDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
          source: 'ai',
        }
      })
      const res = await api<{ committed: number }>(`/projects/${projectId}/tasks/commit`, { method: 'POST', body: { tasks } })
      onCommitted(res.committed)
    } catch {
      setSaving(false)
    }
  }

  const total = draftRef.current?.length ?? 12
  const genN = Math.min(gen, total)
  const genPct = Math.round((genN / total) * 100)
  const highs = rows.filter((r) => r.priority === 'HIGH').length

  const overlay: CSSProperties = { position: 'absolute', inset: 0, background: 'rgba(4,6,11,0.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }
  const card = (w: number): CSSProperties => ({ width: w, maxWidth: '100%', background: '#0B1220', border: '1px solid #2A3A52', borderRadius: 2, boxShadow: '0 30px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' })
  const spark = <svg width="18" height="18" viewBox="0 0 16 16" fill="#16C0AE"><path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11 6.7 7.3 3 6l3.7-1.3z" /><path d="M13 10l.6 1.7 1.7.6-1.7.6L13 15l-.6-1.7-1.7-.6 1.7-.6z" /></svg>

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget && step !== 'generating') onClose() }}>
      {step === 'trigger' && (
        <div style={card(640)}>
          <div style={{ height: 2, background: '#16C0AE' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #1E2A3D', background: '#0E1626' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 2, background: 'rgba(22,192,174,0.14)', border: '1px solid rgba(22,192,174,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spark}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#F0F4FA' }}>Generate tasks with AI</div>
                <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 3 }}>{projectName.toUpperCase()} · {projectCode}</div>
              </div>
            </div>
            <span onClick={onClose} className="mono" style={{ color: '#97A6BC', fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>×</span>
          </div>

          <div className="scroll" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
            <div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>PROJECT DESCRIPTION</div>
              <div style={{ fontSize: 13, color: '#C7D2E1', lineHeight: 1.55, background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '12px 14px' }}>{description || 'No description on file. The AI will infer scope from objectives and team composition.'}</div>
            </div>

            <div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>OBJECTIVES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {objectives.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16C0AE', flex: 'none' }} />
                    <input value={o} onChange={(e) => setObjective(i, e.target.value)} placeholder="Describe an objective…" style={{ flex: 1, fontFamily: 'inherit', fontSize: 13, color: '#C7D2E1', background: 'transparent', border: 'none', outline: 'none' }} />
                    <span onClick={() => removeObjective(i)} className="mono" style={{ color: '#5A6B84', fontSize: 12, cursor: 'pointer', flex: 'none' }}>×</span>
                  </div>
                ))}
                <div onClick={addObjective} className="mono" style={{ fontSize: 11, color: '#3DD5C6', cursor: 'pointer', padding: '2px 4px' }}>+ add objective</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>START</div>
                <div className="mono" style={{ fontSize: 13, color: '#C7D2E1', background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '10px 12px' }}>{fmtDate(startDate)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>TARGET END</div>
                <div className="mono" style={{ fontSize: 13, color: '#C7D2E1', background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '10px 12px' }}>{fmtDate(targetEndDate)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>WINDOW</div>
                <div className="mono" style={{ fontSize: 13, color: '#5BC7BB', background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '10px 12px' }}>{weeks} weeks</div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84' }}>TEAM COMPOSITION · AUTO-DETECTED</span>
                <span className="mono" style={{ fontSize: 9, color: '#5BC7BB', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 6px #3FD07E' }} />{members.length} MEMBERS</span>
              </div>
              <div style={{ background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '12px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px', marginBottom: members.length ? 12 : 0 }}>
                  {members.slice(0, 4).map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: designationColor(m.designation, m.category) }} />
                      <span style={{ fontSize: 12, color: '#C7D2E1' }}>{m.fullName}</span>
                      <span className="mono" style={{ fontSize: 10, color: '#5A6B84', marginLeft: 'auto' }}>{m.designation}</span>
                    </div>
                  ))}
                  {members.length === 0 && <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>No members yet — add members first for smarter assignment.</span>}
                </div>
                {members.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: '1px solid #10192A' }}>
                    {[...composition.entries()].map(([cat, n]) => (
                      <span key={cat} className="mono" style={{ fontSize: 9, color: CHIP[cat].color, border: `1px solid ${CHIP[cat].border}`, borderRadius: 2, padding: '3px 8px' }}>{n} {CHIP[cat].label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderTop: '1px solid #1E2A3D', background: '#0E1626' }}>
            <span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>AI drafts tasks · you review before assigning</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} className="kbtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '10px 18px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={generate} className="aibtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 16 16" fill="#04060B"><path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11 6.7 7.3 3 6l3.7-1.3z" /></svg>Generate tasks</button>
            </div>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div style={card(640)}>
          <div style={{ height: 2, background: '#16C0AE' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid #1E2A3D', background: '#0E1626' }}>
            <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 2, background: 'rgba(22,192,174,0.14)', border: '1px solid rgba(22,192,174,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 16, height: 16, border: '2px solid rgba(22,192,174,0.3)', borderTopColor: '#16C0AE', borderRadius: '50%', animation: 'fon-spin .7s linear infinite' }} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#F0F4FA' }}>Generating tasks…</div>
              <div className="mono" style={{ fontSize: 10, color: '#5BC7BB', marginTop: 3 }}>DRAFTING TASK {String(genN).padStart(2, '0')} OF {total}</div>
            </div>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#F0F4FA' }}>{genPct}%</span>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ height: 5, background: '#152134', overflow: 'hidden', marginBottom: 18 }}><div style={{ width: `${genPct}%`, height: '100%', background: '#16C0AE', transition: 'width .3s' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
              {STATUS_LOG.map((line, i) => {
                const done = i < 2
                return (
                  <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 2, background: done ? 'rgba(34,197,94,0.16)' : 'rgba(22,192,174,0.16)', color: '#5BE59A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flex: 'none' }}>{done ? '✓' : <span style={{ width: 9, height: 9, border: '1.5px solid rgba(22,192,174,0.4)', borderTopColor: '#16C0AE', borderRadius: '50%', animation: 'fon-spin .7s linear infinite' }} />}</span>
                    <span className="mono" style={{ fontSize: 11, color: done ? '#97A6BC' : '#C7D2E1' }}>{line}</span>
                  </div>
                )
              })}
            </div>
            <div className="scroll" style={{ border: '1px solid #1E2A3D', borderRadius: 2, background: '#070C16', height: 250, overflow: 'hidden' }}>
              {Array.from({ length: total }).map((_, i) => {
                const done = i < genN
                const typing = i === genN - 1
                const draft = draftRef.current?.[i]
                const who = draft?.suggestedAssigneeId ? memberById.get(draft.suggestedAssigneeId) : undefined
                const inWindow = i >= Math.max(0, genN - 6) && i < Math.max(6, genN)
                if (!inWindow) return null
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', borderBottom: '1px solid #10192A' }}>
                    <span className="mono" style={{ fontSize: 9, color: '#3C4E6A', width: 16, flex: 'none' }}>{String(i + 1).padStart(2, '0')}</span>
                    {!done || !draft ? (
                      <span className="skel" style={{ height: 9, borderRadius: 2, flex: 1, maxWidth: `${55 + ((i * 29) % 40)}%` }} />
                    ) : (
                      <>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: who ? designationColor(who.designation, who.category) : '#4C8DFF', flex: 'none' }} />
                        <span style={{ fontSize: 12, color: '#E8EDF4', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draft.title}{typing && <span style={{ color: '#16C0AE', animation: 'fon-blink .8s infinite' }}>▋</span>}</span>
                        <span className="mono" style={{ fontSize: 9, color: '#5A6B84', flex: 'none' }}>{initials(who?.fullName)}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderTop: '1px solid #1E2A3D', background: '#0E1626' }}>
            <span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>Streaming from AI · do not close</span>
            <button onClick={onClose} className="kbtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '10px 18px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div style={card(520)}>
          <div style={{ height: 2, background: '#F04438' }} />
          <div style={{ padding: '24px 24px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 2, background: 'rgba(240,68,56,0.14)', border: '1px solid rgba(240,68,56,0.4)', color: '#FF8F94', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>!</span>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#F0F4FA' }}>Generation failed</div>
          </div>
          <div style={{ padding: '8px 24px 20px', fontSize: 13, color: '#C7D2E1', lineHeight: 1.55 }}>{errMsg}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #1E2A3D', background: '#0E1626' }}>
            <button onClick={onClose} className="kbtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '10px 18px', cursor: 'pointer' }}>Close</button>
            <button onClick={() => setStep('trigger')} style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '10px 18px', cursor: 'pointer' }}>Try again</button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div style={card(1160)}>
          <div style={{ height: 2, background: '#16C0AE' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #1E2A3D', background: '#0E1626' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 2, background: 'rgba(22,192,174,0.14)', border: '1px solid rgba(22,192,174,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="#16C0AE"><path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11 6.7 7.3 3 6l3.7-1.3z" /></svg></span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4FA' }}>Review generated tasks</div>
                <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 2 }}>{rows.length} tasks drafted · {highs} high priority · window {fmtDate(startDate)} – {fmtDate(targetEndDate)}</div>
              </div>
            </div>
            <span className="mono" style={{ fontSize: 10, color: '#5BC7BB', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="12" height="12" viewBox="0 0 16 16" fill="#5BC7BB"><path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11 6.7 7.3 3 6l3.7-1.3z" /></svg>AI GENERATED · UNSAVED</span>
          </div>

          <div className="mono" style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 180px 108px 96px 40px', gap: 12, alignItems: 'center', padding: '9px 22px', background: '#0A101E', borderBottom: '1px solid #1E2A3D', fontSize: 9, letterSpacing: '0.09em', color: '#5A6B84' }}>
            <span>#</span><span>TASK</span><span>ASSIGNEE</span><span>PRIORITY</span><span>DUE</span><span />
          </div>

          <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.map((t, idx) => {
              const who = t.assigneeId ? memberById.get(t.assigneeId) : undefined
              const aColor = who ? designationColor(who.designation, who.category) : '#4C8DFF'
              const pm = PRIORITY[t.priority] ?? PRIORITY.MEDIUM
              return (
                <div key={t.id} className="rowh" style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 180px 108px 96px 40px', gap: 12, alignItems: 'start', padding: '12px 22px', borderBottom: '1px solid #10192A' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, paddingTop: 2 }}>
                    <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>{String(idx + 1).padStart(2, '0')}</span>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="#3C4E6A"><path d="M8 1l1.3 3.7L13 6l-3.7 1.3L8 11 6.7 7.3 3 6l3.7-1.3z" /></svg>
                  </div>
                  <div style={{ minWidth: 0, paddingTop: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input className="edit" value={t.title} onChange={(e) => setRow(t.id, { title: e.target.value })} style={{ fontSize: 13, color: '#E8EDF4', fontWeight: 500 }} />
                      {t.edited && <span className="mono" style={{ fontSize: 8, letterSpacing: '0.06em', color: '#FBBF3B', border: '1px solid rgba(244,165,33,0.35)', borderRadius: 2, padding: '1px 5px', flex: 'none' }}>EDITED</span>}
                    </div>
                    <input className="edit" value={t.description} onChange={(e) => setRow(t.id, { description: e.target.value })} style={{ fontSize: 11, color: '#7C89A1', marginTop: 3 }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div onClick={() => setMenu((m) => (m === t.id ? null : t.id))} className="kbtn" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #1E2A3D', borderRadius: 2, padding: '7px 9px', cursor: 'pointer' }}>
                      <span className="mono" style={{ width: 22, height: 22, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${aColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: aColor }}>{initials(who?.fullName)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: '#E8EDF4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who?.fullName ?? 'Unassigned'}</div><div className="mono" style={{ fontSize: 9, color: '#5A6B84', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who?.designation ?? '—'}</div></div>
                      <span className="mono" style={{ color: '#5A6B84', fontSize: 10, flex: 'none' }}>▾</span>
                    </div>
                    {menu === t.id && (
                      <div className="scroll" style={{ position: 'absolute', top: 44, left: 0, width: 190, background: '#0E1626', border: '1px solid #2A3A52', borderRadius: 2, boxShadow: '0 14px 34px rgba(0,0,0,0.7)', zIndex: 40, padding: 4, maxHeight: 230, overflowY: 'auto' }}>
                        {members.map((m) => (
                          <div key={m.id} className="kbtn" onClick={() => { setRow(t.id, { assigneeId: m.id }); setMenu(null) }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 2, cursor: 'pointer' }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: designationColor(m.designation, m.category), flex: 'none' }} />
                            <span style={{ fontSize: 12, color: '#C7D2E1', flex: 1 }}>{m.fullName}</span>
                            <span className="mono" style={{ fontSize: 9, color: '#5A6B84' }}>{initials(m.fullName)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ paddingTop: 5 }}>
                    <span onClick={() => setRow(t.id, { priority: PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(t.priority as never) + 1) % 3] })} className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.05em', color: pm.color, border: `1px solid ${pm.border}`, borderRadius: 2, padding: '5px 10px', cursor: 'pointer' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: pm.color }} />{t.priority}</span>
                  </div>
                  <div style={{ paddingTop: 2 }}>
                    <input className="edit mono" value={t.due} onChange={(e) => setRow(t.id, { due: e.target.value })} placeholder="YYYY-MM-DD" style={{ fontSize: 11, color: '#C7D2E1' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                    <span onClick={() => setRows((rs) => rs.filter((x) => x.id !== t.id))} className="kbtn" style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, color: '#5A6B84', cursor: 'pointer' }} title="Delete task">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M3 4h10M6 4V2.6h4V4M4.5 4l.6 9h5.8l.6-9" /></svg>
                    </span>
                  </div>
                </div>
              )
            })}
            {rows.length === 0 && <div className="mono" style={{ fontSize: 12, color: '#5A6B84', padding: 22 }}>All drafts removed — nothing to assign.</div>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderTop: '1px solid #1E2A3D', background: '#0E1626' }}>
            <span className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>{rows.length} tasks · {rows.filter((r) => r.assigneeId).length} assigned · {highs} high priority</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} className="kbtn" style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#FF8F94', background: 'transparent', border: '1px solid rgba(240,68,56,0.4)', borderRadius: 2, padding: '10px 18px', cursor: 'pointer' }}>Discard</button>
              <button onClick={commit} disabled={rows.length === 0 || saving} style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '10px 20px', cursor: rows.length === 0 ? 'not-allowed' : 'pointer', opacity: rows.length === 0 ? 0.5 : 1 }}>{saving ? 'Assigning…' : 'Assign to team →'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
