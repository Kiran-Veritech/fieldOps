import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FieldLabel, Mono, PrimaryButton } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { ApiError, api } from '../lib/api'
import type { Me } from '../types'
import { C, mono, RADIUS } from '../theme'

const OTP_LEN = 6
const RESEND_COOLDOWN_S = 30

export default function VerifyEmailScreen() {
  const { me, setMe, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const verify = useCallback(async () => {
    const trimmed = code.replace(/\s/g, '')
    if (trimmed.length !== OTP_LEN) {
      setError(`Enter the ${OTP_LEN}-digit code from your email`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await api<Me>('/auth/verify-email', {
        method: 'POST',
        body: { code: trimmed },
      })
      setMe(updated)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }, [code, setMe])

  const resend = useCallback(async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    setError(null)
    try {
      await api('/auth/resend-otp', { method: 'POST' })
      setCooldown(RESEND_COOLDOWN_S)
      setCode('')
      inputRef.current?.focus()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not resend code')
    } finally {
      setResending(false)
    }
  }, [cooldown, resending])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Mono style={styles.eyebrow}>EMAIL VERIFICATION</Mono>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.sub}>
            We sent a {OTP_LEN}-digit code to{' '}
            <Text style={{ color: C.tealText, fontWeight: '600' }}>{me?.workEmail ?? 'your email'}</Text>
            . Enter it below to finish registration.
          </Text>

          <View style={{ height: 28 }} />
          <FieldLabel>VERIFICATION CODE</FieldLabel>
          <View style={styles.input}>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/[^\d]/g, '').slice(0, OTP_LEN))
                setError(null)
              }}
              placeholder="······"
              placeholderTextColor={C.textGhost}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={OTP_LEN}
              style={styles.inputText}
              editable={!busy}
            />
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Mono style={styles.hint}>Code expires in 10 minutes</Mono>
          )}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label={busy ? 'Verifying…' : 'Verify email'}
            disabled={busy || code.length !== OTP_LEN}
            onPress={() => void verify()}
          />
          <Pressable
            onPress={() => void resend()}
            disabled={cooldown > 0 || resending}
            style={styles.resendRow}
          >
            {resending ? (
              <ActivityIndicator color={C.teal} size="small" />
            ) : (
              <Mono style={[styles.resend, ...(cooldown > 0 ? [{ color: C.textFaint }] : [])]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Mono>
            )}
          </Pressable>
          <Pressable onPress={() => void signOut()} style={{ marginTop: 18, alignItems: 'center' }}>
            <Mono style={{ fontSize: 11, color: C.textMute }}>Sign out</Mono>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 28 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.teal,
    marginBottom: 10,
  },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  sub: { fontSize: 14, color: C.textMute, marginTop: 10, lineHeight: 21 },
  input: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 6,
  },
  inputText: {
    fontFamily: mono,
    fontSize: 28,
    letterSpacing: 10,
    color: C.tealBright,
    textAlign: 'center',
  },
  hint: { fontSize: 10, color: C.textFaint, marginTop: 10 },
  error: { fontSize: 12, color: C.redText, marginTop: 10, lineHeight: 18 },
  footer: { paddingHorizontal: 22, paddingBottom: 12, paddingTop: 8 },
  resendRow: { marginTop: 16, alignItems: 'center', minHeight: 22, justifyContent: 'center' },
  resend: { fontSize: 12, color: C.tealText },
})
