import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNetworkOnline } from '../hooks/useNetworkStatus'
import { C, mono } from '../theme'

/** Thin top banner when the device has no network connectivity. */
export function OfflineBanner() {
  const insets = useSafeAreaInsets()
  const networkOnline = useNetworkOnline()

  if (networkOnline) return null

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}>
      <Text style={styles.text}>Offline</Text>
      <Text style={styles.sub}>No internet connection</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#3A1214',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,68,56,0.45)',
    paddingBottom: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    fontFamily: mono,
    fontSize: 12,
    letterSpacing: 1.4,
    color: C.redBright,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  sub: { fontSize: 11, color: '#FFB4B8', marginTop: 2 },
})
