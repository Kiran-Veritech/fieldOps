import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Application from 'expo-application'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'

const DEVICE_KEY = 'fon.deviceId'

function formatId(hex: string): string {
  const h = hex.replace(/[^a-f0-9]/gi, '').toUpperCase().padEnd(8, '0')
  return `DEV-${h.slice(0, 4)}-${h.slice(4, 8)}`
}

/**
 * A stable per-install device id. Prefer the OS vendor id; otherwise mint a
 * random one and persist it so re-registration keeps the same DEV-XXXX-XXXX.
 */
export async function getDeviceId(): Promise<string> {
  const cached = await AsyncStorage.getItem(DEVICE_KEY)
  if (cached) return cached

  let raw: string | null = null
  try {
    if (Platform.OS === 'android') {
      raw = Application.getAndroidId?.() ?? null
    } else if (Platform.OS === 'ios') {
      raw = await Application.getIosIdForVendorAsync?.()
    }
  } catch {
    raw = null
  }
  if (!raw) raw = Crypto.randomUUID().replace(/-/g, '')

  const id = formatId(raw)
  await AsyncStorage.setItem(DEVICE_KEY, id)
  return id
}

export const APP_VERSION = Application.nativeApplicationVersion ?? '1.0.0'
