import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DangerButton, GhostButton, Mono, PrimaryButton } from './ui'
import { PRIORITY_COLOR, TASK_STATUS } from './tokens'
import { ApiError, api } from '../lib/api'
import { dueLabel } from '../lib/format'
import { C, mono, RADIUS } from '../theme'
import type { Task, TaskStatus } from '../types'

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

export function TaskDetailSheet({
  task,
  projectName,
  onClose,
  onUpdated,
}: {
  task: Task | null
  projectName: string
  onClose: () => void
  onUpdated: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocking, setBlocking] = useState(false)
  const [reasonChip, setReasonChip] = useState<string | null>(null)
  const [details, setDetails] = useState('')

  const patch = async (status: TaskStatus, blockedReason?: string) => {
    if (!task) return
    setBusy(true)
    setError(null)
    try {
      await api(`/tasks/${task._id}`, { method: 'PATCH', body: { status, blockedReason } })
      onUpdated()
      resetBlock()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the task.')
    } finally {
      setBusy(false)
    }
  }

  const resetBlock = () => {
    setBlocking(false)
    setReasonChip(null)
    setDetails('')
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

  return (
    <Modal visible={!!task} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>

          {task && st && (
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View
                  style={{
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
                {task.source === 'ai' && (
                  <View style={styles.aiBadge}>
                    <Mono style={{ fontSize: 8, color: '#5BC7BB', letterSpacing: 0.5 }}>✦ AI GENERATED</Mono>
                  </View>
                )}
              </View>

              <Text style={styles.title}>{task.title}</Text>
              {!!task.description && <Text style={styles.desc}>{task.description}</Text>}

              {task.status === 'BLOCKED' && task.blockedReason && (
                <View style={styles.blockedNote}>
                  <Mono style={{ fontSize: 8, color: '#FF8F94', letterSpacing: 0.8, marginBottom: 5 }}>
                    BLOCKED REASON
                  </Mono>
                  <Text style={{ fontSize: 12, color: '#FFB4B8', lineHeight: 17 }}>{task.blockedReason}</Text>
                </View>
              )}

              <View style={styles.infoCard}>
                <InfoRow label="PROJECT" value={projectName} border />
                <View style={[styles.infoRow, styles.infoBorder]}>
                  <Mono style={styles.infoKey}>PRIORITY</Mono>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIORITY_COLOR[task.priority] }} />
                    <Mono style={{ fontSize: 11, color: PRIORITY_COLOR[task.priority] }}>{task.priority}</Mono>
                  </View>
                </View>
                <InfoRow label="DUE" value={dueLabel(task.dueDate)} mono valueColor="#FBBF3B" />
              </View>

              <Mono style={{ fontSize: 9, letterSpacing: 1, color: C.textFaint, marginTop: 18, marginBottom: 10 }}>
                CHANGE STATUS
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
                          : cell.key === 'BLOCKED'
                            ? { borderColor: 'rgba(240,68,56,0.5)' }
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
          )}

          {task && task.status !== 'COMPLETED' && (
            <View style={styles.footer}>
              <PrimaryButton label="Mark completed" loading={busy} onPress={() => patch('COMPLETED')} />
            </View>
          )}
        </SafeAreaView>

        {/* Blocked · reason required */}
        <Modal visible={blocking} transparent animationType="slide" onRequestClose={resetBlock}>
          <View style={styles.backdropDark}>
            <Pressable style={{ flex: 1 }} onPress={resetBlock} />
            <SafeAreaView style={styles.blockSheet} edges={['bottom']}>
              <View style={{ height: 2, backgroundColor: C.red, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <View style={styles.blockIcon}>
                    <Text style={{ color: C.redBright, fontSize: 15, fontWeight: '700' }}>!</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>Mark as blocked</Text>
                    <Mono style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                      {(task?.title ?? '').toUpperCase().slice(0, 34)}
                    </Mono>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: C.textDim, lineHeight: 18, marginVertical: 12 }}>
                  A reason is required so ops can unblock you. It&apos;s attached to the task and visible to your admin.
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
                  <GhostButton label="Cancel" onPress={resetBlock} style={{ flex: 0, paddingHorizontal: 22 }} />
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
      </View>
    </Modal>
  )
}

function InfoRow({
  label,
  value,
  border,
  mono: monoVal,
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
      <Mono style={styles.infoKey}>{label}</Mono>
      <Text style={{ fontFamily: monoVal ? mono : undefined, fontSize: monoVal ? 12 : 12, color: valueColor ?? C.textBody }}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,11,0.6)' },
  backdropDark: { flex: 1, backgroundColor: 'rgba(4,6,11,0.72)' },
  sheet: {
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderColor: C.line2,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    maxHeight: '86%',
  },
  grabberWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  grabber: { width: 36, height: 4, borderRadius: 3, backgroundColor: C.line2 },
  aiBadge: {
    borderWidth: 1,
    borderColor: 'rgba(22,192,174,0.3)',
    borderRadius: RADIUS,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  title: { fontSize: 19, fontWeight: '700', color: C.text, marginTop: 12, lineHeight: 25 },
  desc: { fontSize: 13, color: C.textDim, marginTop: 10, lineHeight: 20 },
  blockedNote: {
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(240,68,56,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(240,68,56,0.25)',
    borderRadius: RADIUS,
  },
  infoCard: { borderWidth: 1, borderColor: C.hairline, borderRadius: RADIUS, marginTop: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: C.hairlineSoft },
  infoKey: { fontSize: 10, color: C.textFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '48.4%',
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingVertical: 11,
    alignItems: 'center',
  },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: C.hairline },
  err: { color: C.redText, fontSize: 12, marginTop: 12 },
  blockSheet: {
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderColor: C.line2,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    maxHeight: '82%',
  },
  blockIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(240,68,56,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,68,56,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
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
