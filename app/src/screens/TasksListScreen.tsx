import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCallback } from 'react'
import { Chip, Mono } from '../components/ui'
import { TASK_STATUS } from '../components/tokens'
import { useMyWork } from '../hooks/useMyWork'
import { dueLabel } from '../lib/format'
import { C, RADIUS } from '../theme'
import type { TaskStatus } from '../types'
import type { TasksStackParams } from '../navigation/tasksTypes'

type FilterKey = 'all' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED'
const FILTERS: { key: FilterKey; label: string; color?: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: '#7DB0FF' },
  { key: 'PENDING', label: 'PENDING', color: '#FBBF3B' },
  { key: 'BLOCKED', label: 'BLOCKED', color: '#FF8A80' },
]

type Props = NativeStackScreenProps<TasksStackParams, 'TasksList'>

export default function TasksListScreen(_props: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<TasksStackParams>>()
  const { tasks, projects, loaded, reload, projectName } = useMyWork()
  const [filter, setFilter] = useState<FilterKey>('all')

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length }
    for (const f of FILTERS) if (f.key !== 'all') c[f.key] = tasks.filter((t) => t.status === f.key).length
    return c
  }, [tasks])

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
  const headerProject = projects[0]?.name?.toUpperCase() ?? 'NO PROJECT'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={{ fontSize: 19, fontWeight: '700', color: C.text }}>Your tasks</Text>
        <Mono style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>
          {tasks.length} ASSIGNED · {headerProject}
        </Mono>
      </View>

      <View style={{ maxHeight: 46 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={`${f.label} ${counts[f.key] ?? 0}`}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>
        {visible.map((t) => {
          const st = TASK_STATUS[t.status as TaskStatus]
          return (
            <Pressable
              key={t._id}
              style={[styles.card, { borderLeftColor: st.color }]}
              onPress={() => navigation.navigate('TaskDetail', { taskId: t._id })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ flex: 1, fontSize: 13, color: '#E8EDF4', fontWeight: '500', lineHeight: 18 }}>
                  {t.title}
                </Text>
                <View style={{ backgroundColor: st.bg, borderRadius: RADIUS, paddingHorizontal: 7, paddingVertical: 3 }}>
                  <Mono style={{ fontSize: 8, color: st.color }}>{st.label}</Mono>
                </View>
              </View>
              {!!t.description && (
                <Text style={{ fontSize: 11, color: C.textMute, marginTop: 6, lineHeight: 15 }} numberOfLines={2}>
                  {t.description}
                </Text>
              )}
              <View style={styles.cardFoot}>
                <Mono style={{ fontSize: 10, color: C.textFaint }}>◷ DUE {dueLabel(t.dueDate)}</Mono>
                {t.source === 'ai' && (
                  <View style={styles.aiTag}>
                    <Mono style={{ fontSize: 8, color: '#5BC7BB', letterSpacing: 0.5 }}>AI-GEN</Mono>
                  </View>
                )}
              </View>
            </Pressable>
          )
        })}

        {loaded && visible.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#E8EDF4' }}>
              {projects.length === 0 ? 'No project assigned yet' : 'No tasks in this filter'}
            </Text>
            <Text style={{ fontSize: 13, color: C.textMute, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>
              {projects.length === 0
                ? "Your operations admin hasn't added you to a project yet."
                : 'Nothing here right now.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  card: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderLeftWidth: 2,
    borderRadius: RADIUS,
    padding: 14,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.hairlineSoft,
  },
  aiTag: {
    borderWidth: 1,
    borderColor: 'rgba(22,192,174,0.3)',
    borderRadius: RADIUS,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 12 },
})
