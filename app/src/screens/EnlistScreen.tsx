import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { ASSET_TYPES } from '../components/tokens'
import { ApiError, enlistAsset } from '../lib/api'
import { C, mono, RADIUS } from '../theme'
import type { AssetsScreenProps } from '../navigation/assetsTypes'

export default function EnlistScreen({ navigation }: AssetsScreenProps<'Enlist'>) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('Camera')
  const [serial, setSerial] = useState('')
  const [description, setDescription] = useState('')
  const [typeOpen, setTypeOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capture = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      let result: ImagePicker.ImagePickerResult
      if (perm.granted) {
        result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true })
      }
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri)
    } catch {
      // fall back to library if the camera isn't available (e.g. simulator)
      try {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true })
        if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri)
      } catch {
        setError('Could not open the camera or photo library.')
      }
    }
  }

  const valid = name.trim().length > 0 && serial.trim().length > 0

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await enlistAsset({
        name: name.trim(),
        type,
        serialNumber: serial.trim(),
        description: description.trim(),
        photoUri: photo,
      })
      navigation.replace('Submitted', { name: name.trim(), type, serialNumber: serial.trim() })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Submission failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Mono style={{ fontSize: 18, color: C.textDim }}>‹</Mono>
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>Enlist an asset</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View>
            <FieldLabel>PHOTO · OPTIONAL</FieldLabel>
            {photo ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.capturedTag}>
                  <Mono style={{ fontSize: 9, color: '#5BC7BB' }}>✓ CAPTURED</Mono>
                </View>
                <View style={styles.photoActions}>
                  <Pressable style={styles.photoAction} onPress={capture}>
                    <Mono style={{ fontSize: 10, color: C.textBody }}>↻ Retake</Mono>
                  </Pressable>
                  <Pressable style={[styles.photoAction, { borderColor: 'rgba(240,68,56,0.4)' }]} onPress={() => setPhoto(null)}>
                    <Mono style={{ fontSize: 10, color: '#FF8F94' }}>Remove</Mono>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.photoEmpty} onPress={capture}>
                <Text style={{ fontSize: 26, color: C.textFaint }}>▣</Text>
                <Mono style={{ fontSize: 10, color: C.textFaint, letterSpacing: 0.6 }}>TAP TO CAPTURE</Mono>
              </Pressable>
            )}
          </View>

          <View>
            <FieldLabel>ASSET NAME</FieldLabel>
            <View style={styles.input}>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. Thermal Camera FLIR-E8" placeholderTextColor={C.textFaint} style={styles.inputText} />
            </View>
          </View>

          <View>
            <FieldLabel>ASSET TYPE</FieldLabel>
            <Pressable style={styles.select} onPress={() => setTypeOpen(true)}>
              <Text style={{ fontSize: 14, color: '#E8EDF4' }}>{type}</Text>
              <Mono style={{ color: C.textFaint, fontSize: 12 }}>▾</Mono>
            </Pressable>
          </View>

          <View>
            <FieldLabel>SERIAL NUMBER / ASSET ID</FieldLabel>
            <View style={[styles.input, { borderColor: serial ? C.teal : C.hairline }]}>
              <TextInput
                value={serial}
                onChangeText={setSerial}
                placeholder="SN-00000"
                placeholderTextColor={C.textFaint}
                autoCapitalize="characters"
                style={[styles.inputText, { fontFamily: mono, color: C.tealText }]}
              />
            </View>
          </View>

          <View>
            <FieldLabel>DESCRIPTION</FieldLabel>
            <View style={styles.input}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="What is this asset used for?"
                placeholderTextColor={C.textFaint}
                style={[styles.inputText, { minHeight: 56, textAlignVertical: 'top' }]}
              />
            </View>
          </View>

          {error && <Text style={{ color: C.redText, fontSize: 12 }}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label="Submit for approval" onPress={submit} disabled={!valid} loading={busy} />
        </View>
      </KeyboardAvoidingView>

      <Modal visible={typeOpen} transparent animationType="fade" onRequestClose={() => setTypeOpen(false)}>
        <Pressable style={styles.typeBackdrop} onPress={() => setTypeOpen(false)}>
          <View style={styles.typeSheet}>
            {ASSET_TYPES.map((t) => (
              <Pressable
                key={t}
                style={styles.typeRow}
                onPress={() => {
                  setType(t)
                  setTypeOpen(false)
                }}
              >
                <Text style={{ fontSize: 14, color: t === type ? C.tealText : C.textBody }}>{t}</Text>
                {t === type && <Text style={{ color: C.teal }}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  photoEmpty: {
    height: 130,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line2,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: C.panel,
  },
  photoWrap: { height: 180, borderWidth: 1, borderColor: C.hairline, borderRadius: RADIUS, overflow: 'hidden', backgroundColor: '#131C2E' },
  capturedTag: {
    position: 'absolute',
    top: 8,
    left: 10,
    backgroundColor: 'rgba(22,192,174,0.16)',
    borderRadius: RADIUS,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoActions: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', gap: 7 },
  photoAction: {
    backgroundColor: 'rgba(11,18,32,0.85)',
    borderWidth: 1,
    borderColor: C.line2,
    borderRadius: RADIUS,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
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
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.hairline, backgroundColor: C.panel },
  typeBackdrop: { flex: 1, backgroundColor: 'rgba(4,6,11,0.6)', justifyContent: 'center', paddingHorizontal: 30 },
  typeSheet: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line2, borderRadius: RADIUS, paddingVertical: 6 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
})
