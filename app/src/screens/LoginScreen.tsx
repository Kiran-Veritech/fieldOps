import { useState } from 'react'
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
import { Brand, FieldLabel, Mono, PrimaryButton } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { ApiError, login } from '../lib/api'
import { getDeviceInfo } from '../lib/device'
import { C, RADIUS } from '../theme'
import type { AuthScreenProps } from '../navigation/types'

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { setMe } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = email.trim().includes('@') && password.length >= 6

  const onSubmit = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const device = await getDeviceInfo()
      const res = await login(email.trim().toLowerCase(), password, {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
      })
      setMe(res.user)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <View style={{ marginBottom: 28 }}>
            <Brand />
          </View>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.sub}>Use your work email and password to continue.</Text>

          <View style={{ height: 26 }} />
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
            />
          </View>

          <View style={{ height: 18 }} />
          <FieldLabel>PASSWORD</FieldLabel>
          <View style={styles.input}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={C.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.inputText}
            />
          </View>

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() || undefined })}
            style={{ alignSelf: 'flex-end', marginTop: 12 }}
          >
            <Mono style={{ fontSize: 11, color: C.tealText }}>Forgot password?</Mono>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label={busy ? 'Signing in…' : 'Sign in'}
            disabled={!valid || busy}
            onPress={() => void onSubmit()}
          />
          {busy ? <ActivityIndicator color={C.teal} style={{ marginTop: 12 }} /> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
            <Text style={{ fontSize: 12, color: C.textMute }}>Don&apos;t have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Mono style={{ fontSize: 12, color: C.tealText }}>Sign up</Mono>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 12 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  sub: { fontSize: 13, color: C.textMute, marginTop: 6 },
  input: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RADIUS,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  inputText: { fontSize: 14, color: '#E8EDF4' },
  error: { fontSize: 12, color: C.redText, marginTop: 14, lineHeight: 18 },
  footer: { paddingHorizontal: 22, paddingBottom: 12, paddingTop: 8 },
})
