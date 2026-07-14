import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { C, mono } from '../theme'

/**
 * Branded boot splash — radar mark + thin indeterminate bar.
 * Shown while auth restores; fades when the parent unmounts it.
 */
export function BrandSplash() {
  const pulse = useRef(new Animated.Value(0)).current
  const sweep = useRef(new Animated.Value(0)).current
  const fadeIn = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )

    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    )

    pulseLoop.start()
    sweepLoop.start()
    return () => {
      pulseLoop.stop()
      sweepLoop.stop()
    }
  }, [fadeIn, pulse, sweep])

  const outerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.55] })
  const midOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] })
  const outerScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] })
  const midScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.02] })
  const barX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-64, 64] })

  return (
    <View style={styles.root} accessibilityLabel="FieldOps Nexus loading">
      <View style={styles.glow} />
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        <View style={styles.markWrap}>
          <Animated.View
            style={[styles.ring, styles.ringOuter, { opacity: outerOpacity, transform: [{ scale: outerScale }] }]}
          />
          <Animated.View
            style={[styles.ring, styles.ringMid, { opacity: midOpacity, transform: [{ scale: midScale }] }]}
          />
          <View style={[styles.ring, styles.ringInner]} />
          <View style={styles.core} />
          <View style={styles.crossH} />
          <View style={styles.crossV} />
        </View>

        <Text style={styles.brand}>FIELDOPS</Text>
        <Text style={styles.sub}>NEXUS</Text>

        <View style={styles.track}>
          <Animated.View style={[styles.bar, { transform: [{ translateX: barX }] }]} />
        </View>
        <Text style={styles.status}>INITIALIZING</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(22,192,174,0.06)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  markWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: C.teal,
    borderRadius: 999,
  },
  ringOuter: { width: 112, height: 112 },
  ringMid: { width: 72, height: 72 },
  ringInner: { width: 36, height: 36, opacity: 0.9 },
  core: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.teal,
  },
  crossH: {
    position: 'absolute',
    width: 112,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(22,192,174,0.18)',
  },
  crossV: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    height: 112,
    backgroundColor: 'rgba(22,192,174,0.18)',
  },
  brand: {
    fontFamily: mono,
    fontSize: 22,
    letterSpacing: 6,
    color: C.text,
    fontWeight: '600',
  },
  sub: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 8,
    color: C.tealText,
    marginTop: 8,
    marginBottom: 36,
  },
  track: {
    width: 120,
    height: 1,
    backgroundColor: C.hairline,
    overflow: 'hidden',
    borderRadius: 1,
  },
  bar: {
    width: 48,
    height: 1,
    backgroundColor: C.teal,
    alignSelf: 'center',
  },
  status: {
    fontFamily: mono,
    fontSize: 9,
    letterSpacing: 2.4,
    color: C.textGhost,
    marginTop: 14,
  },
})
