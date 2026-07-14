import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { DangerButton, GhostButton, Mono, PrimaryButton } from '../components/ui'
import { TASK_STATUS } from '../components/tokens'
import { useAuth } from '../auth/AuthContext'
import { ApiError, api } from '../lib/api'
import { dueLabel } from '../lib/format'
import { C, mono, RADIUS } from '../theme'
import type { ProjectLite, Task, TaskStatus } from '../types'
import type { TasksStackParams } from '../navigation/tasksTypes'

const STATUS_CELLS: { key: TaskStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'COMPLETED', label: 'Completed' },
]

const CELL_COLOR: Record<TaskStatus, string> = {
  PENDING: '#FBBF3B',
  IN_PROGRESS: '#7DB0FF',
  BLOCKED: '#FF8A80',
  COMPLETED: '#5BE59A',
}

const BLOCK_REASONS = ['Awaiting permit', 'Material shortage', 'Access denied', 'Weather']

type Props = NativeStackScreenProps<TasksStackParams, 'TaskDetail'>

export default function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params
  const { me } = useAuth()
  const [task, setTask] = useState<Task | null>(null)
  const [projectName, setProjectName] = useState('—')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocking, setBlocking] = useState(false)
  const [reasonChip, setReasonChip] = useState<string | null>(null)
  const [details, setDetails] = useState('')

  const load = useCallback(async () => {
    if (!me) return
    try {
      const [tasks, projects] = await Promise.all([
        api<Task[]>(`/tasks?assigneeId=${me.id}`),
        api<ProjectLite[]>('/projects/mine'),
      ])
      const t = tasks.find((x) => x._id === taskId) ?? null
      setTask(t)
      if (t) {
        setProjectName(projects.find((p) => p._id === t.projectId)?.name ?? '—')
      }
    } catch {
      // keep
    }
  }, [taskId, me])

  useEffect(() => {
    load()
  }, [load])

  const patch = async (status: TaskStatus, blockedReason?: string) => {
    if (!task) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api<Task>(`/tasks/${task._id}`, {
        method: 'PATCH',
        body: { status, blockedReason },
      })
      setTask(updated)
      setBlocking(false)
      setReasonChip(null)
      setDetails('')
      if (status === 'COMPLETED') navigation.goBack()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the task.')
    } finally {
      setBusy(false)
    }
  }

  const chooseStatus = (status: TaskStatus) => {
    if (!task || status === task.status) return
    if (status === 'BLOCKED') {
      setBlocking(true)
      return
    }
    void patch(status)
  }

  const composedReason = details.trim() || reasonChip || ''
  const st = task ? TASK_STATUS[task.status] : null
  const code = task ? `TASK · ${task._id.slice(0, 8).toUpperCase()}` : 'TASK'

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Mono style={{ fontSize: 18, color: C.textDim }}>‹</Mono>
        </Pressable>
        <Mono style={{ fontSize: 11, letterSpacing: 0.6, color: C.textFaint }}>{code}</Mono>
      </View>

      {!task || !st ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mono style={{ color: C.textFaint }}>Loading…</Mono>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: st.bg,
                borderLeftWidth: 2,
                borderLeftColor: st.color,
                borderRadius: RADIUS,
                paddingHorizontal: 9,
                paddingVertical: 4,
              }}
            >
              <Mono style={{ fontSize: 9, color: st.color }}>{st.label}</Mono>
            </View>
            <Text style={styles.title}>{task.title}</Text>
            {!!task.description && <Text style={styles.desc}>{task.description}</Text>}

            <View style={styles.infoCard}>
              <InfoRow label="PROJECT" value={projectName} border />
              <InfoRow label="DUE" value={dueLabel(task.dueDate)} mono valueColor="#FBBF3B" border />
              <InfoRow
                label="SOURCE"
                value={task.source === 'ai' ? 'AI-GENERATED' : 'MANUAL'}
                mono
                valueColor={task.source === 'ai' ? '#5BC7BB' : C.textBody}
              />
            </View>

            {task.status === 'BLOCKED' && task.blockedReason && (
              <View style={styles.blockedNote}>
                <Mono style={{ fontSize: 8, color: '#FF8F94', letterSpacing: 0.8, marginBottom: 5 }}>
                  BLOCKED REASON
                </Mono>
                <Text style={{ fontSize: 12, color: '#FFB4B8', lineHeight: 17 }}>{task.blockedReason}</Text>
              </View>
            )}

            <Mono style={{ fontSize: 9, letterSpacing: 1, color: C.textFaint, marginTop: 18, marginBottom: 10 }}>
              UPDATE STATUS
            </Mono>
            <View style={styles.grid}>
              {STATUS_CELLS.map((cell) => {
                const active = task.status === cell.key
                const color = CELL_COLOR[cell.key]
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => chooseStatus(cell.key)}
                    disabled={busy}
                    style={[
                      styles.cell,
                      active
                        ? { borderColor: color, backgroundColor: `${color}1A` }
                        : { borderColor: C.hairline },
                    ]}
                  >
                    <Mono style={{ fontSize: 11, color, fontWeight: active ? '700' : '400' }}>
                      {cell.label}
                      {active ? ' ✓' : ''}
                    </Mono>
                  </Pressable>
                )
              })}
            </View>
            {error && <Text style={styles.err}>{error}</Text>}
          </ScrollView>

          {task.status !== 'COMPLETED' && (
            <View style={styles.footer}>
              <PrimaryButton label="Mark completed" loading={busy} onPress={() => patch('COMPLETED')} />
            </View>
          )}
        </>
      )}

      <Modal visible={blocking} transparent animationType="slide" onRequestClose={() => setBlocking(false)}>
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setBlocking(false)} />
          <SafeAreaView style={styles.blockSheet} edges={['bottom']}>
            <View style={{ height: 2, backgroundColor: C.red, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>Mark as blocked</Text>
              <Text style={{ fontSize: 12, color: C.textDim, lineHeight: 18, marginVertical: 12 }}>
                A reason is required so ops can unblock you.
              </Text>
              <Mono style={{ fontSize: 9, letterSpacing: 1, color: C.textFaint, marginBottom: 8 }}>COMMON REASONS</Mono>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                {BLOCK_REASONS.map((r) => {
                  const active = reasonChip === r
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setReasonChip(active ? null : r)}
                      style={[
                        styles.reasonChip,
                        active
                          ? { backgroundColor: 'rgba(240,68,56,0.1)', borderColor: 'rgba(240,68,56,0.5)' }
                          : { borderColor: C.hairline },
                      ]}
                    >
                      <Mono style={{ fontSize: 10, color: active ? '#FF8A80' : C.textBody }}>{r}</Mono>
                    </Pressable>
                  )
                })}
              </View>
              <Mono style={{ fontSize: 9, letterSpacing: 1, color: C.textFaint, marginBottom: 8 }}>DETAILS</Mono>
              <View style={styles.textarea}>
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  multiline
                  placeholder="Add specifics for your admin…"
                  placeholderTextColor={C.textFaint}
                  style={{ fontSize: 13, color: C.textBody, minHeight: 64, textAlignVertical: 'top' }}
                />
              </View>
              {error && <Text style={styles.err}>{error}</Text>}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <GhostButton label="Cancel" onPress={() => setBlocking(false)} style={{ flex: 0, paddingHorizontal: 22 }} />
                <View style={{ flex: 1 }}>
                  <DangerButton
                    label={busy ? 'Saving…' : 'Confirm blocked'}
                    onPress={() => composedReason && patch('BLOCKED', composedReason)}
                  />
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function InfoRow({
  label,
  value,
  border,
  mono: isMono,
  valueColor,
}: {
  label: string
  value: string
  border?: boolean
  mono?: boolean
  valueColor?: string
}) {
  return (
    <View style={[styles.infoRow, border && styles.infoBorder]}>
      <Mono style={{ fontSize: 10, color: C.textFaint }}>{label}</Mono>
      <Text style={{ fontFamily: isMono ? mono : undefined, fontSize: 12, color: valueColor ?? C.textBody }}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  title: { fontSize: 19, fontWeight: '700', color: C.text, marginTop: 12, lineHeight: 25 },
  desc: { fontSize: 13, color: C.textDim, marginTop: 10, lineHeight: 20 },
  infoCard: { borderWidth: 1, borderColor: C.hairline, borderRadius: RADIUS, marginTop: 18 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: C.hairlineSoft },
  blockedNote: {
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(240,68,56,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(240,68,56,0.25)',
    borderRadius: RADIUS,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '48.4%',
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingVertical: 11,
    alignItems: 'center',
  },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: C.hairline, backgroundColor: C.panel },
  err: { color: C.redText, fontSize: 12, marginTop: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,11,0.72)' },
  blockSheet: {
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderColor: C.line2,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    maxHeight: '82%',
  },
  reasonChip: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 10, paddingVertical: 6 },
  textarea: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: RADIUS,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
})
