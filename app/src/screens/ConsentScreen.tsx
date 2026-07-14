import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PrimaryButton } from '../components/ui'
import { usePresence } from '../location/PresenceProvider'
import { C, RADIUS } from '../theme'
import type { AuthScreenProps } from '../navigation/types'

const ROWS: { title: string; body: string; accent?: string }[] = [
  { title: "What's collected", body: 'Your precise GPS location and device ID.' },
  { title: 'How often', body: 'A ping every 10 seconds, only while the app is open on screen.' },
  {
    title: 'When it stops',
    body: 'The moment you close or background the app. No background tracking, ever.',
    accent: C.greenText,
  },
  { title: 'Who can see it', body: 'Only your operations admins — never other field staff.' },
]

export default function ConsentScreen({ navigation, route }: AuthScreenProps<'Consent'>) {
  const { requestPermission, openSystemSettings, canAskAgain } = usePresence()
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  const proceedAfter = () => navigation.navigate('Capturing', route.params)

  const allow = async () => {
    if (busy) return
    setBusy(true)
    setDenied(false)
    try {
      const granted = await requestPermission()
      if (granted) {
        proceedAfter()
        return
      }
      setDenied(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={styles.icon}>
            <Text style={{ color: C.teal, fontSize: 24 }}>◎</Text>
          </View>
          <Text style={styles.title}>Enable location</Text>
          <Text style={styles.sub}>
            FieldOps needs location while you use the app so operations can see you on the live map.
          </Text>
        </View>

        <View style={styles.card}>
          {ROWS.map((r, i) => (
            <View key={r.title} style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}>
              <View style={[styles.dot, { borderColor: r.accent ?? '#5BC7BB' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {denied && (
          <Text style={styles.denied}>
            {canAskAgain
              ? 'Permission was not granted. Tap Allow to try again — location is required for live presence.'
              : 'Location is blocked for this app. Open system settings to enable it, then return here.'}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={busy ? 'Requesting…' : 'Allow while using the app'}
          onPress={allow}
          disabled={busy}
          loading={busy}
        />
        {denied && !canAskAgain && (
          <Pressable style={styles.secondary} onPress={() => void openSystemSettings()}>
            <Text style={styles.secondaryText}>Open settings</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.secondary}
          disabled={busy}
          onPress={proceedAfter}
          accessibilityRole="button"
          accessibilityLabel="Continue without location"
        >
          {busy ? (
            <ActivityIndicator color={C.textDim} />
          ) : (
            <Text style={styles.skipText}>Continue without location</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, padding: 22, justifyContent: 'center' },
  icon: {
    width: 52,
    height: 52,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: 'rgba(22,192,174,0.4)',
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 21, fontWeight: '700', color: C.text },
  sub: { fontSize: 13, color: C.textDim, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  card: { borderWidth: 1, borderColor: C.hairline, borderRadius: RADIUS },
  row: { flexDirection: 'row', gap: 12, padding: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.hairlineSoft },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.4, marginTop: 2 },
  rowTitle: { fontSize: 13, color: '#E8EDF4', fontWeight: '600' },
  rowBody: { fontSize: 12, color: C.textDim, marginTop: 3, lineHeight: 17 },
  denied: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    color: C.amberBright,
    textAlign: 'center',
  },
  footer: { paddingHorizontal: 22, paddingBottom: 8 },
  secondary: { paddingVertical: 13, alignItems: 'center' },
  secondaryText: { fontSize: 13, fontWeight: '600', color: C.tealText },
  skipText: { fontSize: 13, fontWeight: '600', color: C.textDim },
})
