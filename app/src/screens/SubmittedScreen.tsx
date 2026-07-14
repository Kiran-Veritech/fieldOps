import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GhostButton, Mono, PrimaryButton } from '../components/ui'
import { C, RADIUS } from '../theme'
import type { AssetsScreenProps } from '../navigation/assetsTypes'

export default function SubmittedScreen({ navigation, route }: AssetsScreenProps<'Submitted'>) {
  const { name, type, serialNumber } = route.params

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.check}>
          <Text style={{ color: C.greenText, fontSize: 34, fontWeight: '700' }}>✓</Text>
        </View>
        <Text style={styles.title}>Submitted for approval</Text>
        <Text style={styles.sub}>
          Your admin will review this asset. You&apos;ll get a notification once it&apos;s approved or if changes are
          needed.
        </Text>

        <View style={styles.card}>
          <View style={styles.glyph}>
            <Text style={{ fontSize: 18, color: C.textFaint }}>❖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: '#E8EDF4', fontWeight: '500' }}>{name}</Text>
            <Mono style={{ fontSize: 10, color: C.textFaint, marginTop: 3 }}>
              {type.toUpperCase()} · {serialNumber}
            </Mono>
          </View>
          <View style={styles.pending}>
            <Mono style={{ fontSize: 8, color: '#FBBF3B' }}>PENDING</Mono>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="View my assets" onPress={() => navigation.navigate('AssetsList')} />
        <GhostButton label="Enlist another" onPress={() => navigation.replace('Enlist')} style={{ marginTop: 9 }} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 21, fontWeight: '700', color: C.text },
  sub: { fontSize: 13, color: C.textDim, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: C.hairline,
    borderLeftWidth: 2,
    borderLeftColor: '#FBBF3B',
    borderRadius: RADIUS,
    padding: 14,
    marginTop: 22,
  },
  glyph: {
    width: 40,
    height: 40,
    borderRadius: RADIUS,
    backgroundColor: C.panelAlt,
    borderWidth: 1,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: { backgroundColor: 'rgba(244,165,33,0.12)', borderRadius: RADIUS, paddingHorizontal: 8, paddingVertical: 4 },
  footer: { paddingHorizontal: 20, paddingBottom: 8 },
})
