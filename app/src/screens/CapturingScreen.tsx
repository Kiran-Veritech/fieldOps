import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PrimaryButton } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { APP_VERSION, getDeviceId } from '../lib/device'
import { ApiError, register } from '../lib/api'
import { C, mono, RADIUS } from '../theme'
import type { AuthScreenProps } from '../navigation/types'

// Fallback fix (Gurugram / Delhi NCR) if the user declined location so
// registration — which requires an initial location — can still complete.
const FALLBACK = { lat: 28.4601, lng: 77.0281 }

type Step = { done: boolean; label: string; value: string; valueColor?: string }

export default function CapturingScreen({ navigation, route }: AuthScreenProps<'Capturing'>) {
  const { setMe } = useAuth()
  const { email, fullName, designation } = route.params
  const [deviceId, setDeviceId] = useState('…')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    ;(async () => {
      const dev = await getDeviceId()
      setDeviceId(dev)

      let loc = FALLBACK
      try {
        const { status } = await Location.getForegroundPermissionsAsync()
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }
      } catch {
        loc = FALLBACK
      }
      setCoords(loc)

      // Brief pause so the "capturing" sequence is legible, then register.
      await new Promise((r) => setTimeout(r, 900))
      try {
        const res = await register({
          workEmail: email,
          fullName,
          designation,
          deviceId: dev,
          appVersion: APP_VERSION,
          initialLocation: loc,
        })
        setMe(res.user)
        // On success the root navigator swaps to the tab app automatically.
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Could not reach operations. Check your connection.'
        setError(msg)
      }
    })()
  }, [email, fullName, designation, setMe])

  const steps: Step[] = [
    { done: deviceId !== '…', label: 'Device registered', value: deviceId },
    {
      done: !!coords,
      label: 'Initial location captured',
      value: coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '…',
      valueColor: '#5BC7BB',
    },
  ]

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <View style={[styles.errIcon]}>
            <Text style={{ color: C.redBright, fontSize: 26 }}>!</Text>
          </View>
          <Text style={styles.title}>Couldn&apos;t set you up</Text>
          <Text style={styles.sub}>{error}</Text>
        </View>
        <View style={{ padding: 22 }}>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              started.current = false
              setError(null)
              navigation.replace('Capturing', route.params)
            }}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={C.teal} />
        </View>
        <Text style={styles.title}>Setting you up</Text>
        <Text style={styles.sub}>Capturing your device and first location fix…</Text>

        <View style={styles.card}>
          {steps.map((s, i) => (
            <View key={s.label} style={[styles.row, i < steps.length && styles.rowBorder]}>
              <View style={[styles.check, { backgroundColor: s.done ? 'rgba(34,197,94,0.14)' : 'rgba(22,192,174,0.14)' }]}>
                {s.done ? (
                  <Text style={{ color: C.greenText, fontWeight: '700', fontSize: 12 }}>✓</Text>
                ) : (
                  <ActivityIndicator size="small" color={C.teal} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#E8EDF4' }}>{s.label}</Text>
                <Text style={{ fontFamily: mono, fontSize: 11, color: s.valueColor ?? C.textFaint, marginTop: 2 }}>
                  {s.value}
                </Text>
              </View>
            </View>
          ))}
          <View style={styles.row}>
            <View style={[styles.check, { backgroundColor: 'rgba(22,192,174,0.14)' }]}>
              <ActivityIndicator size="small" color={C.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#E8EDF4' }}>Syncing with operations…</Text>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.textFaint, marginTop: 2 }}>SENDING FIRST PING</Text>
            </View>
          </View>
        </View>

        <View style={styles.goingOnline}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} />
          <Text style={{ fontFamily: mono, fontSize: 11, color: C.green, letterSpacing: 0.5 }}>GOING ONLINE</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  spinnerWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  sub: { fontSize: 13, color: C.textDim, marginTop: 7, textAlign: 'center' },
  card: { width: '100%', borderWidth: 1, borderColor: C.hairline, borderRadius: RADIUS, marginTop: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.hairlineSoft },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  goingOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: 'rgba(63,208,126,0.3)',
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  errIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(240,68,56,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,68,56,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
})
