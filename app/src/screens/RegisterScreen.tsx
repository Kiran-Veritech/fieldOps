import { useEffect, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FieldLabel, Mono, PrimaryButton } from '../components/ui'
import { DesignationPicker } from '../components/DesignationPicker'
import { categoryFor, CATEGORY_LABEL, designationColor } from '../data/designations'
import { api } from '../lib/api'
import { C, mono, RADIUS } from '../theme'
import type { AuthScreenProps } from '../navigation/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [designation, setDesignation] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [touchedEmail, setTouchedEmail] = useState(false)
  const [domains, setDomains] = useState<string[]>([])

  useEffect(() => {
    api<{ approvedDomains: string[] }>('/auth/domains', { auth: false })
      .then((r) => setDomains(r.approvedDomains))
      .catch(() => setDomains([]))
  }, [])

  const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : ''
  const emailWellFormed = EMAIL_RE.test(email.trim())
  const domainApproved = domains.length === 0 || (domain !== '' && domains.includes(domain))
  const emailError = touchedEmail && email.length > 0 && (!emailWellFormed || !domainApproved)

  const valid = emailWellFormed && domainApproved && fullName.trim().length > 0 && !!designation

  const catColor = useMemo(
    () => (designation ? designationColor(designation) : C.blue),
    [designation],
  )
  const cat = designation ? categoryFor(designation) : undefined

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 22 }}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.sub}>Register with your work email to join your team.</Text>
          </View>

          <FieldLabel>WORK EMAIL</FieldLabel>
          <View style={[styles.input, emailError && { borderColor: C.redSoft }]}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouchedEmail(true)}
              placeholder={domains[0] ? `you@${domains[0]}` : 'you@company.com'}
              placeholderTextColor={C.textFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.inputText}
            />
          </View>
          {emailError && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>
                Use your{' '}
                <Text style={{ color: '#FFB4B8', fontWeight: '700' }}>
                  {domains[0] ? `@${domains[0]}` : '@company'}
                </Text>{' '}
                work email
                {domain ? (
                  <Text>
                    {' '}— <Text style={{ fontFamily: mono, fontSize: 11 }}>{domain}</Text> isn&apos;t an approved
                    domain.
                  </Text>
                ) : (
                  '.'
                )}
              </Text>
            </View>
          )}

          <View style={{ height: 18 }} />
          <FieldLabel>FULL NAME</FieldLabel>
          <View style={styles.input}>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={C.textFaint}
              style={styles.inputText}
            />
          </View>

          <View style={{ height: 18 }} />
          <FieldLabel>DESIGNATION</FieldLabel>
          <Pressable style={styles.select} onPress={() => setPickerOpen(true)}>
            {designation ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: catColor }} />
                <Text style={{ fontSize: 14, color: C.text }}>{designation}</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 14, color: C.textFaint }}>Select your designation</Text>
            )}
            <Mono style={{ color: C.textFaint, fontSize: 12 }}>▾</Mono>
          </Pressable>
          <Mono style={{ fontSize: 10, color: C.textFaint, marginTop: 7 }}>
            {cat ? `${CATEGORY_LABEL[cat].replace(' & DESIGN', ' & Design')} · sets your map marker colour` : 'Sets your map marker colour'}
          </Mono>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label="Continue"
            disabled={!valid}
            onPress={() =>
              navigation.navigate('Consent', {
                email: email.trim(),
                fullName: fullName.trim(),
                designation: designation as string,
              })
            }
          />
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
            <Text style={{ fontSize: 12, color: C.textMute }}>Already registered? </Text>
            <Mono style={{ fontSize: 12, color: C.tealText }}>Sign in</Mono>
          </View>
        </View>
      </KeyboardAvoidingView>

      <DesignationPicker
        visible={pickerOpen}
        selected={designation}
        onClose={() => setPickerOpen(false)}
        onSelect={(d) => {
          setDesignation(d)
          setPickerOpen(false)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 22, paddingBottom: 8 },
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
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RADIUS,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  errorRow: { marginTop: 8 },
  errorText: { fontSize: 12, color: '#FF8F94', lineHeight: 18 },
  footer: { paddingHorizontal: 22, paddingBottom: 8, paddingTop: 8 },
})
