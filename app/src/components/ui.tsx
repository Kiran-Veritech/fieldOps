import { type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'
import { C, mono, RADIUS } from '../theme'

export function Mono({ children, style }: { children: ReactNode; style?: TextStyle | TextStyle[] }) {
  return <Text style={[{ fontFamily: mono, color: C.textDim }, style]}>{children}</Text>
}

/** Filter chip used on the Tasks and Assets lists. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: C.teal } : { borderWidth: 1, borderColor: C.hairline },
      ]}
    >
      <Text
        style={{
          fontFamily: mono,
          fontSize: 10,
          letterSpacing: 0.4,
          color: active ? C.bgDeep : C.textDim,
          fontWeight: active ? '700' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function StatusBadge({
  label,
  color,
  bg,
}: {
  label: string
  color: string
  bg: string
}) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: RADIUS, paddingHorizontal: 7, paddingVertical: 3 }}>
      <Text style={{ fontFamily: mono, fontSize: 8, letterSpacing: 0.4, color }}>{label}</Text>
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}) {
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={[
        styles.btn,
        off ? { backgroundColor: '#0E1626', borderWidth: 1, borderColor: C.hairline } : { backgroundColor: C.teal },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={C.bgDeep} size="small" />
      ) : (
        <Text style={{ fontSize: 14, fontWeight: '600', color: off ? C.textFaint : C.bgDeep }}>{label}</Text>
      )}
    </Pressable>
  )
}

export function GhostButton({ label, onPress, style }: { label: string; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, { borderWidth: 1, borderColor: C.line2 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: C.textBody }}>{label}</Text>
    </Pressable>
  )
}

export function DangerButton({ label, onPress, style }: { label: string; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: C.redSoft }, style]}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{label}</Text>
    </Pressable>
  )
}

/** The FieldOps Nexus wordmark + radar glyph used on onboarding. */
export function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <View style={styles.brandGlyph}>
        <View style={{ width: 11, height: 11, borderWidth: 2, borderColor: C.teal, borderRadius: 6 }} />
        <View style={styles.brandDot} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
        FieldOps <Text style={{ color: C.teal }}>Nexus</Text>
      </Text>
    </View>
  )
}

export function Avatar({
  text,
  color,
  size = 34,
  online,
  dim,
}: {
  text: string
  color: string
  size?: number
  online?: boolean
  dim?: boolean
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS,
        backgroundColor: C.panelAlt,
        borderWidth: 1,
        borderColor: dim ? C.line2 : color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: mono, fontSize: size * 0.34, fontWeight: '700', color: dim ? C.textFaint : C.blueText }}>
        {text}
      </Text>
      {online && (
        <View
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 15,
            height: 15,
            borderRadius: 8,
            backgroundColor: C.green,
            borderWidth: 2,
            borderColor: C.bg,
          }}
        />
      )}
    </View>
  )
}

/** SYNC LIVE / SYNC OFF pill from the app top bar. */
export function SyncPill({ live }: { live: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: live ? 'rgba(63,208,126,0.35)' : C.hairline,
        borderRadius: RADIUS,
        paddingHorizontal: 9,
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: live ? C.green : C.grey,
        }}
      />
      <Text style={{ fontFamily: mono, fontSize: 9, letterSpacing: 0.4, color: live ? C.green : '#94A0B4' }}>
        {live ? 'SYNC LIVE' : 'SYNC OFF'}
      </Text>
    </View>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1, color: C.textFaint, marginBottom: 8 }}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: RADIUS,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 7,
  },
  btn: {
    width: '100%',
    borderRadius: RADIUS,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGlyph: {
    width: 26,
    height: 26,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    backgroundColor: C.teal,
    borderRadius: 2,
  },
})
