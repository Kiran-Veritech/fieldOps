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
import { ApiError, api } from '../lib/api'
import { C, mono, RADIUS } from '../theme'
import type { AuthScreenProps } from '../navigation/types'

const OTP_LEN = 6
const MIN_PASSWORD = 6
const RESEND_COOLDOWN_S = 30

type Step = 'email' | 'otp' | 'password'

export default function ForgotPasswordScreen({ navigation, route }: AuthScreenProps<'ForgotPassword'>) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(route.params?.email ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const otpRef = useRef<TextInput>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const sendOtp = useCallback(async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed.includes('@')) {
      setError('Enter a valid work email')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: { workEmail: trimmed },
        auth: false,
      })
      setEmail(trimmed)
      setStep('otp')
      setCooldown(RESEND_COOLDOWN_S)
      setCode('')
      setTimeout(() => otpRef.current?.focus(), 200)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send code')
    } finally {
      setBusy(false)
    }
  }, [email])

  const verifyOtp = useCallback(async () => {
    const trimmed = code.replace(/\s/g, '')
    if (trimmed.length !== OTP_LEN) {
      setError(`Enter the ${OTP_LEN}-digit code`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ resetToken: string }>('/auth/forgot-password/verify', {
        method: 'POST',
        body: { workEmail: email, code: trimmed },
        auth: false,
      })
      setResetToken(res.resetToken)
      setStep('password')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invalid code')
    } finally {
      setBusy(false)
    }
  }, [code, email])

  const savePassword = useCallback(async () => {
    if (!resetToken) return
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api('/auth/forgot-password/reset', {
        method: 'POST',
        body: { resetToken, password },
        auth: false,
      })
      navigation.replace('Login')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reset password')
    } finally {
      setBusy(false)
    }
  }, [resetToken, password, confirm, navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: 18 }}>
            <Mono style={{ fontSize: 11, color: C.textFaint }}>‹ Back</Mono>
          </Pressable>
          <Mono style={styles.eyebrow}>PASSWORD RESET</Mono>
          <Text style={styles.title}>
            {step === 'email' ? 'Forgot password' : step === 'otp' ? 'Check your inbox' : 'New password'}
          </Text>
          <Text style={styles.sub}>
            {step === 'email'
              ? 'We will email a one-time code to your work address.'
              : step === 'otp'
                ? `Enter the ${OTP_LEN}-digit code sent to ${email}.`
                : 'Choose a new password, then sign in.'}
          </Text>

          <View style={{ height: 26 }} />

          {step === 'email' && (
            <>
              <FieldLabel>WORK EMAIL</FieldLabel>
              <View style={styles.input}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@veritech.ai"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  style={styles.inputText}
                  editable={!busy}
                />
              </View>
            </>
          )}

          {step === 'otp' && (
            <>
              <FieldLabel>VERIFICATION CODE</FieldLabel>
              <View style={styles.input}>
                <TextInput
                  ref={otpRef}
                  value={code}
                  onChangeText={(t) => {
                    setCode(t.replace(/[^\d]/g, '').slice(0, OTP_LEN))
                    setError(null)
                  }}
                  placeholder="······"
                  placeholderTextColor={C.textGhost}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={OTP_LEN}
                  style={styles.otpText}
                  editable={!busy}
                />
              </View>
              <Pressable
                onPress={() => void sendOtp()}
                disabled={cooldown > 0 || busy}
                style={{ marginTop: 14, alignItems: 'center' }}
              >
                <Mono style={{ fontSize: 11, color: cooldown > 0 ? C.textFaint : C.tealText }}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </Mono>
              </Pressable>
            </>
          )}

          {step === 'password' && (
            <>
              <FieldLabel>NEW PASSWORD</FieldLabel>
              <View style={styles.input}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  placeholderTextColor={C.textFaint}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.inputText}
                  editable={!busy}
                />
              </View>
              <View style={{ height: 18 }} />
              <FieldLabel>CONFIRM PASSWORD</FieldLabel>
              <View style={styles.input}>
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  placeholderTextColor={C.textFaint}
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.inputText}
                  editable={!busy}
                />
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label={
              busy
                ? 'Please wait…'
                : step === 'email'
                  ? 'Send code'
                  : step === 'otp'
                    ? 'Verify code'
                    : 'Save password'
            }
            disabled={
              busy ||
              (step === 'email' && !email.trim().includes('@')) ||
              (step === 'otp' && code.length !== OTP_LEN) ||
              (step === 'password' && (password.length < MIN_PASSWORD || password !== confirm))
            }
            onPress={() =>
              void (step === 'email' ? sendOtp() : step === 'otp' ? verifyOtp() : savePassword())
            }
          />
          {busy ? <ActivityIndicator color={C.teal} style={{ marginTop: 12 }} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 12 },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, color: C.teal, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  sub: { fontSize: 13, color: C.textMute, marginTop: 6, lineHeight: 19 },
  input: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RADIUS,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  inputText: { fontSize: 14, color: '#E8EDF4' },
  otpText: {
    fontFamily: mono,
    fontSize: 28,
    letterSpacing: 10,
    color: C.tealBright,
    textAlign: 'center',
  },
  error: { fontSize: 12, color: C.redText, marginTop: 14, lineHeight: 18 },
  footer: { paddingHorizontal: 22, paddingBottom: 12, paddingTop: 8 },
})
