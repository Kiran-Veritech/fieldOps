import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native'
import { C } from '../theme'

/**
 * Pulsating “live ping” radar used on Home when the operator is online.
 * Multiple expanding rings so the motion reads continuously.
 */
export function PulsatingPing({
  active,
  color = C.teal,
  size = 58,
  style,
}: {
  active: boolean
  color?: string
  size?: number
  style?: ViewStyle
}) {
  const a1 = useRef(new Animated.Value(0)).current
  const a2 = useRef(new Animated.Value(0)).current
  const a3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!active) {
      a1.setValue(0)
      a2.setValue(0)
      a3.setValue(0)
      return
    }
    const loop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      )
    const l1 = loop(a1, 0)
    const l2 = loop(a2, 600)
    const l3 = loop(a3, 1200)
    l1.start()
    l2.start()
    l3.start()
    return () => {
      l1.stop()
      l2.stop()
      l3.stop()
    }
  }, [active, a1, a2, a3])

  const ring = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.55, 0.35, 0] }),
    transform: [
      {
        scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
      },
    ],
  })

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {active && (
        <>
          <Animated.View
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, borderColor: color },
              ring(a1),
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, borderColor: color },
              ring(a2),
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, borderColor: color },
              ring(a3),
            ]}
          />
        </>
      )}
      <View
        style={{
          width: size * 0.24,
          height: size * 0.24,
          borderRadius: size * 0.12,
          backgroundColor: active ? color : C.grey,
          shadowColor: active ? color : 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: active ? 0.9 : 0,
          shadowRadius: 8,
        }}
      />
    </View>
  )
}

/** Small green status dot with a soft pulse when online (avatar / pills). */
export function OnlinePulseDot({ online, size = 8 }: { online: boolean; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!online) {
      pulse.setValue(0)
      return
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [online, pulse])

  return (
    <View style={{ width: size * 2.2, height: size * 2.2, alignItems: 'center', justifyContent: 'center' }}>
      {online && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size * 2.2,
            height: size * 2.2,
            borderRadius: size * 1.1,
            backgroundColor: C.green,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            transform: [
              {
                scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }),
              },
            ],
          }}
        />
      )}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: online ? C.green : C.grey,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
})
