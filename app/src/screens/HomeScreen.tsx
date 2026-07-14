import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { Avatar, Mono } from '../components/ui'
import { OnlinePulseDot, PulsatingPing } from '../components/PulsatingPing'
import { TASK_STATUS } from '../components/tokens'
import { usePresence } from '../location/PresenceProvider'
import { useMyWork } from '../hooks/useMyWork'
import { designationColor } from '../data/designations'
import { initials, timeAgo } from '../lib/format'
import { C, mono, RADIUS } from '../theme'
import type { Task } from '../types'
import type { AppTabParams } from '../navigation/appTypes'

/** Pick the most relevant "up next" task: in-progress first, else pending. */
function pickUpNext(tasks: Task[]): Task | null {
  const active = tasks.filter((t) => t.status === 'IN_PROGRESS')
  if (active.length) return active[0]
  const pending = tasks.filter((t) => t.status === 'PENDING')
  if (pending.length) return pending[0]
  return tasks.find((t) => t.status !== 'COMPLETED') ?? null
}

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParams>>()
  const { me, tasks, projectName, loaded } = useMyWork()
  const { sharing, setSharing, lastPingAt, lastLocation, hasPermission, enableSharing } = usePresence()
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const catColor = designationColor(me?.designation)
  const live = sharing && hasPermission && lastPingAt !== null && Date.now() - lastPingAt < 60_000
  const coords = lastLocation ?? me?.lastLocation ?? me?.initialLocation
  const pingAgo = lastPingAt ? timeAgo(new Date(lastPingAt).toISOString()).toUpperCase() : '—'

  const counts = useMemo(
    () => ({
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      pending: tasks.filter((t) => t.status === 'PENDING').length,
      blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
    }),
    [tasks],
  )
  const upNext = pickUpNext(tasks)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Avatar text={initials(me?.fullName ?? '')} color={catColor} online={online} size={34} />
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{me?.fullName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: catColor }} />
              <Mono style={{ fontSize: 10, color: C.textFaint }}>{me?.designation}</Mono>
            </View>
          </View>
        </View>
        <View
          style={[
            styles.onlinePill,
            {
              borderColor: online ? 'rgba(63,208,126,0.35)' : C.hairline,
            },
          ]}
        >
          <OnlinePulseDot online={online} size={6} />
          <Mono style={{ fontSize: 10, color: online ? C.green : '#94A0B4' }}>{online ? 'ONLINE' : 'OFFLINE'}</Mono>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
        <View style={styles.shareCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Mono style={{ fontSize: 10, letterSpacing: 1, color: C.textFaint }}>LOCATION SHARING</Mono>
            <Mono style={{ fontSize: 10, color: sharing && hasPermission ? C.tealBright : C.textFaint }}>
              {sharing && hasPermission ? 'LIVE' : !hasPermission ? 'NO GPS' : 'PAUSED'}
            </Mono>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={styles.radar}>
              {sharing && hasPermission && <View style={styles.radarRing} />}
              <View
                style={[
                  styles.radarDot,
                  {
                    backgroundColor: sharing && hasPermission ? C.teal : C.grey,
                    shadowColor: sharing && hasPermission ? C.teal : 'transparent',
                  },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>
                {!hasPermission
                  ? 'Location permission needed'
                  : sharing
                    ? 'Sharing every 10s'
                    : 'Sharing paused'}
              </Text>
              <Mono style={{ fontSize: 11, color: sharing && hasPermission ? '#5BC7BB' : C.textFaint, marginTop: 4 }}>
                {!hasPermission
                  ? 'TAP ENABLE TO ALLOW GPS'
                  : sharing
                    ? `LAST PING ${pingAgo}`
                    : 'NO PINGS TRANSMITTING'}
              </Mono>
              {coords && hasPermission && (
                <Mono style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </Mono>
              ) : (
                <Mono style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>No fix yet</Mono>
              )}
            </View>
          </View>
          <View style={styles.shareFoot}>
            <Text style={{ fontSize: 11, color: C.textMute, flex: 1 }}>Stops when you close the app</Text>
            <Pressable
              onPress={() => {
                if (!hasPermission) void enableSharing()
                else setSharing(!sharing)
              }}
            >
              <Mono style={{ fontSize: 10, color: C.tealText }}>
                {!hasPermission ? 'Enable' : sharing ? 'Pause' : 'Resume'}
              </Mono>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>Your tasks</Text>
          <Pressable onPress={() => navigation.navigate('Tasks')}>
            <Mono style={{ fontSize: 11, color: C.tealText }}>View all ›</Mono>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <CountCard n={counts.inProgress} label="IN PROGRESS" color="#7DB0FF" />
          <CountCard n={counts.pending} label="PENDING" color="#FBBF3B" />
          <CountCard n={counts.blocked} label="BLOCKED" color="#FF8A80" />
        </View>

        <Mono style={{ fontSize: 9, letterSpacing: 1, color: C.textFaint, marginBottom: 8 }}>UP NEXT</Mono>
        {upNext ? (
          <Pressable
            style={[styles.upNext, { borderLeftColor: TASK_STATUS[upNext.status].color }]}
            onPress={() =>
              navigation.navigate('Tasks', { screen: 'TaskDetail', params: { taskId: upNext._id } })
            }
          >
            <Text style={{ fontSize: 13, color: '#E8EDF4', fontWeight: '500', lineHeight: 18 }}>{upNext.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
              <Mono style={{ fontSize: 10, color: C.textFaint }}>{projectName(upNext.projectId).toUpperCase()}</Mono>
              <View
                style={{
                  backgroundColor: TASK_STATUS[upNext.status].bg,
                  borderLeftWidth: 2,
                  borderLeftColor: TASK_STATUS[upNext.status].color,
                  borderRadius: RADIUS,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Mono style={{ fontSize: 9, color: TASK_STATUS[upNext.status].color }}>
                  {TASK_STATUS[upNext.status].label}
                </Mono>
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={styles.upNextEmpty}>
            <Mono style={{ fontSize: 11, color: C.textFaint }}>
              {loaded ? "No open tasks — you're clear." : 'Loading…'}
            </Mono>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function CountCard({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={styles.countCard}>
      <Text style={{ fontFamily: mono, fontSize: 22, fontWeight: '700', color, lineHeight: 24 }}>{n}</Text>
      <Mono style={{ fontSize: 8, letterSpacing: 0.6, color: C.textFaint, marginTop: 5 }}>{label}</Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  shareCard: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RADIUS,
    backgroundColor: C.panel,
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  shareFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: C.hairlineSoft,
  },
  countCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  upNext: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderLeftWidth: 2,
    borderRadius: RADIUS,
    padding: 14,
  },
  upNextEmpty: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RADIUS,
    padding: 16,
    alignItems: 'center',
  },
})
