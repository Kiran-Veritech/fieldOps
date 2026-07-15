import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GhostButton, Mono } from './ui'
import { C } from '../theme'

export type InfoTopic = 'notifications' | 'privacy' | 'help'

type Section = { heading: string; body: string }

const CONTENT: Record<
  InfoTopic,
  { eyebrow: string; title: string; lead: string; sections: Section[] }
> = {
  notifications: {
    eyebrow: 'ACCOUNT',
    title: 'Notifications',
    lead: 'How FieldOps keeps you informed while you work in the field.',
    sections: [
      {
        heading: 'Location sharing',
        body: 'You appear on the live operations map only while this app is open. Closing the app ends transmission within about a minute — no background alerts for location.',
      },
      {
        heading: 'Work updates',
        body: 'Task assignments, status changes, and asset review decisions reach you when you open FieldOps. Push alerts may expand as your organization enables them.',
      },
      {
        heading: 'System permission',
        body: 'Device notification settings are controlled in your phone\'s system settings. FieldOps never sends marketing messages.',
      },
    ],
  },
  privacy: {
    eyebrow: 'ACCOUNT',
    title: 'Privacy & data',
    lead: 'What we collect, why we collect it, and who can see it.',
    sections: [
      {
        heading: 'What we collect',
        body: 'Work email, name, designation, device ID, and precise GPS coordinates — only while the app is open on screen.',
      },
      {
        heading: 'What we do not do',
        body: 'No background tracking after you leave the app. Other field staff cannot see your position — only your operations admins.',
      },
      {
        heading: 'Why we need it',
        body: 'Location and device binding let ops coordinate the field in real time and detect unusual device reuse across accounts.',
      },
      {
        heading: 'Your control',
        body: 'Log out to stop sharing immediately. Uninstalling or denying location permission removes your live presence from the map.',
      },
    ],
  },
  help: {
    eyebrow: 'ACCOUNT',
    title: 'Help & support',
    lead: 'Quick answers for common FieldOps Nexus issues.',
    sections: [
      {
        heading: 'Cannot appear online',
        body: 'Allow location permission, keep the app open, and confirm you have an internet connection. Sharing cannot be paused — it stops only when you close the app.',
      },
      {
        heading: 'Sign-in or OTP issues',
        body: 'Use your approved work email domain. Check spam for verification codes. Codes expire after a few minutes — use Resend on the verification screen if needed.',
      },
      {
        heading: 'Contact operations',
        body: 'For account access, map visibility, or task problems, reach your FieldOps administrator, or email support@veritech.ai.',
      },
    ],
  },
}

type Props = {
  topic: InfoTopic | null
  onClose: () => void
}

export function ProfileInfoSheet({ topic, onClose }: Props) {
  const content = topic ? CONTENT[topic] : null

  return (
    <Modal visible={!!topic} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.accent} />
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {content ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Mono style={styles.eyebrow}>{content.eyebrow}</Mono>
              <Text style={styles.title}>{content.title}</Text>
              <Text style={styles.lead}>{content.lead}</Text>

              <View style={styles.divider} />

              {content.sections.map((section, i) => (
                <View
                  key={section.heading}
                  style={[styles.section, i < content.sections.length - 1 && styles.sectionGap]}
                >
                  <Mono style={styles.sectionHeading}>{section.heading.toUpperCase()}</Mono>
                  <Text style={styles.sectionBody}>{section.body}</Text>
                </View>
              ))}

              <View style={{ marginTop: 22 }}>
                <GhostButton label="Close" onPress={onClose} />
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,11,0.72)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '78%',
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderColor: C.line2,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  accent: {
    height: 2,
    backgroundColor: C.teal,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 3, backgroundColor: C.line2 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.teal,
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  lead: {
    fontSize: 13,
    color: C.textMute,
    lineHeight: 20,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: C.hairlineSoft,
    marginVertical: 18,
  },
  section: {},
  sectionGap: { marginBottom: 16 },
  sectionHeading: {
    fontSize: 9,
    letterSpacing: 1.1,
    color: C.textFaint,
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 13,
    color: C.textBody,
    lineHeight: 20,
  },
})
