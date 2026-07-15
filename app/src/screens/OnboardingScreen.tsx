import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Brand, Mono, PrimaryButton } from '../components/ui'
import { C, mono } from '../theme'
import type { AuthScreenProps } from '../navigation/types'

function Dots({ index }: { index: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 18 }}>
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            width: i === index ? 20 : 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: i === index ? C.teal : C.line2,
          }}
        />
      ))}
    </View>
  )
}

/** Slide 1 — radar with team markers. */
function Radar() {
  return (
    <View style={styles.radar}>
      <View style={[styles.ring, { width: 172, height: 172, borderColor: 'rgba(22,192,174,0.14)' }]} />
      <View style={[styles.ring, { width: 118, height: 118, borderColor: 'rgba(22,192,174,0.2)' }]} />
      <View style={[styles.ring, { width: 64, height: 64, borderColor: 'rgba(22,192,174,0.3)' }]} />
      <View style={[styles.ring, { width: 172, height: 172, borderColor: C.teal }]} />
      <View style={styles.radarCore} />
      <View style={[styles.marker, { top: 38, left: 44, backgroundColor: '#2E6BF0' }]} />
      <View style={[styles.marker, { top: 110, left: 120, backgroundColor: '#F59E0B' }]} />
      <View style={[styles.marker, { top: 120, left: 40, backgroundColor: '#C084FC' }]} />
    </View>
  )
}

/** Slide 2 — location pin. */
function Pin() {
  return (
    <View style={[styles.radar, { width: 150, height: 150 }]}>
      <View style={[styles.ring, { width: 150, height: 150, borderColor: 'rgba(63,208,126,0.18)' }]} />
      <View style={[styles.ring, { width: 96, height: 96, borderColor: 'rgba(63,208,126,0.22)' }]} />
      <View style={{ width: 44, height: 44 }}>
        <View style={styles.pinBody} />
        <View style={styles.pinHole} />
      </View>
    </View>
  )
}

export default function OnboardingScreen({ navigation }: AuthScreenProps<'Onboarding'>) {
  const [index, setIndex] = useState(0)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Brand />
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Mono style={{ fontSize: 11, color: C.textFaint }}>Skip</Mono>
        </Pressable>
      </View>

      <View style={styles.body}>
        {index === 0 ? <Radar /> : <Pin />}
        {index === 0 ? (
          <>
            <Text style={styles.title}>See your team,{'\n'}live on the map.</Text>
            <Text style={styles.sub}>
              FieldOps Nexus keeps field operations coordinated — tasks, assets, and who&apos;s where, updated in
              real time.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Location is shared{'\n'}while the app is open</Text>
            <Text style={styles.sub}>
              While FieldOps Nexus is open, your position updates every 20 seconds so ops can coordinate the field.
              Close the app and sharing stops — no background tracking.
            </Text>
            <View style={styles.pingChip}>
              <View style={styles.pingDot} />
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.tealBright }}>
                PING EVERY 20s · ONLY WHILE OPEN
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Dots index={index} />
        <PrimaryButton
          label={index === 0 ? 'Next' : 'Get started'}
          onPress={() => (index === 0 ? setIndex(1) : navigation.navigate('Register'))}
        />
        <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: 14, alignItems: 'center' }}>
          <Mono style={{ fontSize: 12, color: C.tealText }}>Already registered? Sign in</Mono>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    lineHeight: 30,
    marginTop: 20,
  },
  sub: { fontSize: 14, color: C.textDim, textAlign: 'center', lineHeight: 22, marginTop: 12 },
  footer: { paddingHorizontal: 22, paddingBottom: 8 },
  radar: { width: 172, height: 172, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1, borderRadius: 999 },
  radarCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.teal, zIndex: 2 },
  marker: { position: 'absolute', width: 9, height: 9, borderRadius: 5 },
  pinBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    backgroundColor: C.green,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    transform: [{ rotate: '-45deg' }],
  },
  pinHole: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.bg,
  },
  pingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: 2,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  pingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
})
