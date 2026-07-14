import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Avatar, DangerButton, GhostButton, Mono } from '../components/ui'
import { OnlinePulseDot } from '../components/PulsatingPing'
import { useAuth } from '../auth/AuthContext'
import { usePresence } from '../location/PresenceProvider'
import { designationColor } from '../data/designations'
import { APP_VERSION } from '../lib/device'
import { initials, isoDate, timeAgo } from '../lib/format'
import { C, mono, RADIUS } from '../theme'

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        backgroundColor: on ? C.teal : C.line2,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: on ? C.bgDeep : C.textDim,
        }}
      />
    </Pressable>
  )
}

export default function ProfileScreen() {
  const { me, signOut } = useAuth()
  const { sharing, setSharing, lastPingAt, online, hasPermission, requestPermission, pingNow } = usePresence()
  const [confirm, setConfirm] = useState(false)
  const [, setTick] = useState(0)

  // Refresh the "LAST Xs AGO" label every second.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const catColor = designationColor(me?.designation)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>Profile</Text>
        <Text style={{ fontSize: 16, color: C.textFaint }}>⚙</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 22 }}>
          <Avatar text={initials(me?.fullName ?? '')} color={catColor} size={60} online={online} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{me?.fullName}</Text>
            <Mono style={{ fontSize: 11, color: '#5BC7BB', marginTop: 4 }}>{me?.workEmail}</Mono>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: catColor }} />
              <Text style={{ fontSize: 12, color: C.textDim }}>
                {me?.designation} · {me?.category}
              </Text>
            </View>
          </View>
        </View>

        <Mono style={styles.sectionLabel}>LOCATION SHARING</Mono>
        <View style={[styles.shareCard, { borderLeftColor: online ? C.teal : C.line2 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <OnlinePulseDot online={online} size={8} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>
                  {!hasPermission
                    ? 'Location permission off'
                    : sharing
                      ? online
                        ? 'Sharing is on'
                        : 'Connecting…'
                      : 'Sharing is off'}
                </Text>
                <Mono style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                  {sharing
                    ? `PING EVERY 10s · LAST ${timeAgo(lastPingAt ? new Date(lastPingAt).toISOString() : null).toUpperCase()}`
                    : 'NO PINGS TRANSMITTING'}
                </Mono>
              </View>
            </View>
            {hasPermission ? (
              <Toggle on={sharing} onPress={() => setSharing(!sharing)} />
            ) : (
              <Pressable
                onPress={async () => {
                  const ok = await requestPermission()
                  if (ok) {
                    setSharing(true)
                    void pingNow()
                  }
                }}
              >
                <Mono style={{ fontSize: 10, color: C.tealText }}>ALLOW</Mono>
              </Pressable>
            )}
          </View>
          <Text style={styles.shareBody}>
            {sharing
              ? "You're visible to operations on the live map. Sharing runs only while the app is open and stops the moment you close it — never in the background."
              : 'Turn sharing back on to appear on the live map. Ops currently cannot see your position.'}
          </Text>
        </View>

        <Mono style={styles.sectionLabel}>DEVICE INFO</Mono>
        <View style={styles.card}>
          <InfoRow label="DEVICE ID" value={me?.deviceId ?? '—'} valueColor={C.tealText} border />
          <InfoRow label="APP VERSION" value={APP_VERSION} border />
          <InfoRow label="REGISTERED ON" value={isoDate(me?.createdAt)} />
        </View>

        <Mono style={styles.sectionLabel}>ACCOUNT</Mono>
        <View style={styles.card}>
          {['Notifications', 'Privacy & data', 'Help & support'].map((label, i) => (
            <View key={label} style={[styles.accRow, i < 2 && styles.rowBorder]}>
              <Text style={{ flex: 1, fontSize: 13, color: C.textBody }}>{label}</Text>
              <Mono style={{ fontSize: 12, color: C.textFaint }}>›</Mono>
            </View>
          ))}
        </View>

        <Pressable style={styles.logout} onPress={() => setConfirm(true)}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#FF8F94' }}>⇥  Log out</Text>
        </Pressable>
        <Mono style={{ textAlign: 'center', fontSize: 10, color: C.textGhost, marginTop: 16, letterSpacing: 0.6 }}>
          FIELDOPS NEXUS · v{APP_VERSION}
        </Mono>
      </ScrollView>

      <Modal visible={confirm} transparent animationType="slide" onRequestClose={() => setConfirm(false)}>
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setConfirm(false)} />
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={{ height: 2, backgroundColor: C.red, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <View style={{ width: 36, height: 4, borderRadius: 3, backgroundColor: C.line2 }} />
            </View>
            <View style={{ padding: 22, paddingTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <View style={styles.logoutIcon}>
                  <Text style={{ color: C.redBright, fontSize: 16 }}>⇥</Text>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '600', color: C.text }}>Log out?</Text>
              </View>
              <Text style={{ fontSize: 14, color: C.textBody, lineHeight: 22 }}>
                Logging out stops location sharing. You&apos;ll show as{' '}
                <Text style={{ color: C.text, fontWeight: '700' }}>offline</Text> within 60 seconds.
              </Text>
              <View style={styles.warn}>
                <Text style={{ color: C.amberBright, fontSize: 14 }}>⚠</Text>
                <Mono style={{ fontSize: 11, color: '#F4C77A', flex: 1, lineHeight: 15 }}>
                  Any in-progress task pings will stop transmitting.
                </Mono>
              </View>
              <View style={{ marginTop: 20, gap: 9 }}>
                <DangerButton
                  label="Log out"
                  onPress={async () => {
                    setConfirm(false)
                    await signOut()
                  }}
                />
                <GhostButton label="Stay signed in" onPress={() => setConfirm(false)} />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function InfoRow({
  label,
  value,
  valueColor,
  border,
}: {
  label: string
  value: string
  valueColor?: string
  border?: boolean
}) {
  return (
    <View style={[styles.infoRow, border && styles.rowBorder]}>
      <Mono style={{ fontSize: 10, letterSpacing: 0.6, color: C.textFaint }}>{label}</Mono>
      <Mono style={{ fontSize: 12, color: valueColor ?? C.textBody }}>{value}</Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  sectionLabel: { fontSize: 9, letterSpacing: 1, color: C.textFaint, marginBottom: 8, marginTop: 12 },
  shareCard: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderLeftWidth: 2,
    borderRadius: RADIUS,
    padding: 14,
    marginBottom: 8,
  },
  shareBody: {
    fontSize: 12,
    color: C.textDim,
    lineHeight: 18,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.hairlineSoft,
  },
  card: { borderWidth: 1, borderColor: C.hairline, borderRadius: RADIUS, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.hairlineSoft },
  logout: {
    borderWidth: 1,
    borderColor: 'rgba(240,68,56,0.4)',
    borderRadius: RADIUS,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,11,0.72)' },
  sheet: {
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderColor: C.line2,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  logoutIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(240,68,56,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,68,56,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    backgroundColor: '#0C0A0A',
    borderWidth: 1,
    borderColor: C.hairline,
    borderLeftWidth: 2,
    borderLeftColor: C.amber,
    borderRadius: RADIUS,
    padding: 11,
  },
})
