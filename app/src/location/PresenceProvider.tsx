import * as Location from 'expo-location'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import type { GeoPoint } from '../types'

const PING_INTERVAL_MS = 20_000
const ONLINE_WINDOW_MS = 60_000

type PresenceState = {
  sharing: boolean
  setSharing: (on: boolean) => void
  lastPingAt: number | null
  lastLocation: GeoPoint | null
  hasPermission: boolean
  canAskAgain: boolean
  online: boolean
  requestPermission: () => Promise<boolean>
  openSystemSettings: () => Promise<void>
  enableSharing: () => Promise<boolean>
  pingNow: () => Promise<boolean>
}

const PresenceContext = createContext<PresenceState | null>(null)

async function readGps(): Promise<GeoPoint | null> {
  try {
    const last = await Location.getLastKnownPositionAsync()
    if (last) {
      return { lat: last.coords.latitude, lng: last.coords.longitude }
    }
  } catch {
    // try a fresh fix below
  }
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch {
    return null
  }
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [sharing, setSharingState] = useState(true)
  const [lastPingAt, setLastPingAt] = useState<number | null>(null)
  const [lastLocation, setLastLocation] = useState<GeoPoint | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [canAskAgain, setCanAskAgain] = useState(true)
  const [, setTick] = useState(0)
  const appActive = useRef(AppState.currentState === 'active')
  const promptedRef = useRef(false)

  const syncPermission = useCallback(async () => {
    try {
      const { status, canAskAgain: again } = await Location.getForegroundPermissionsAsync()
      setHasPermission(status === 'granted')
      setCanAskAgain(again)
      return status === 'granted'
    } catch {
      setHasPermission(false)
      return false
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const servicesOn = await Location.hasServicesEnabledAsync()
      if (!servicesOn) {
        // Device location master switch is off — send user to settings.
        if (Platform.OS === 'android') {
          await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() =>
            Linking.openSettings(),
          )
        } else {
          await Linking.openSettings()
        }
        setHasPermission(false)
        return false
      }

      const current = await Location.getForegroundPermissionsAsync()
      if (current.status === 'granted') {
        setHasPermission(true)
        setCanAskAgain(current.canAskAgain)
        return true
      }

      const { status, canAskAgain: again } = await Location.requestForegroundPermissionsAsync()
      const granted = status === 'granted'
      setHasPermission(granted)
      setCanAskAgain(again)
      return granted
    } catch {
      setHasPermission(false)
      return false
    }
  }, [])

  const openSystemSettings = useCallback(async () => {
    await Linking.openSettings()
  }, [])

  const enableSharing = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermission()
    if (granted) {
      setSharingState(true)
      return true
    }
    setSharingState(false)
    return false
  }, [requestPermission])

  const setSharing = useCallback(
    (on: boolean) => {
      // Location sharing cannot be paused while signed in — only app close stops it.
      if (!on) return
      void enableSharing()
    },
    [enableSharing],
  )

  const pingNow = useCallback(async (): Promise<boolean> => {
    if (!me) return false

    let permission = hasPermission
    if (!permission) {
      const { status } = await Location.getForegroundPermissionsAsync()
      permission = status === 'granted'
      setHasPermission(permission)
    }
    if (!permission) return false

    const coords = await readGps()
    if (!coords) return false

    try {
      await api('/pings', { method: 'POST', body: coords })
      setLastLocation(coords)
      setLastPingAt(Date.now())
      return true
    } catch {
      return false
    }
  }, [me, hasPermission])

  // Session restore: seed last known location + prompt for permission once.
  useEffect(() => {
    if (!me) {
      setLastPingAt(null)
      setLastLocation(null)
      setSharingState(true)
      promptedRef.current = false
      return
    }

    if (me.lastLocation) setLastLocation(me.lastLocation)
    if (me.lastPingAt) {
      const ts = new Date(me.lastPingAt).getTime()
      if (!Number.isNaN(ts)) setLastPingAt(ts)
    }

    let cancelled = false
    ;(async () => {
      const granted = await syncPermission()
      if (cancelled || promptedRef.current) return
      if (!granted && sharing) {
        promptedRef.current = true
        await requestPermission()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [me?.id, sharing, syncPermission, requestPermission])

  // Ping loop while signed in, email-verified, sharing, permissioned, and foregrounded.
  useEffect(() => {
    if (!me || me.emailVerified === false || !sharing || !hasPermission) return
    let interval: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (interval) return
      void pingNow()
      interval = setInterval(() => {
        if (appActive.current) void pingNow()
      }, PING_INTERVAL_MS)
    }
    const stop = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      appActive.current = next === 'active'
      if (next === 'active') {
        void syncPermission()
        start()
      } else {
        stop()
      }
    })

    if (appActive.current) start()

    return () => {
      stop()
      sub.remove()
    }
  }, [me, sharing, hasPermission, pingNow, syncPermission])

  useEffect(() => {
    if (!me || !sharing) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [me, sharing])

  const online =
    !!me &&
    sharing &&
    hasPermission &&
    lastPingAt !== null &&
    Date.now() - lastPingAt < ONLINE_WINDOW_MS

  const value = useMemo<PresenceState>(
    () => ({
      sharing,
      setSharing,
      lastPingAt,
      lastLocation,
      hasPermission,
      canAskAgain,
      online,
      requestPermission,
      openSystemSettings,
      enableSharing,
      pingNow,
    }),
    [
      sharing,
      setSharing,
      lastPingAt,
      lastLocation,
      hasPermission,
      canAskAgain,
      online,
      requestPermission,
      openSystemSettings,
      enableSharing,
      pingNow,
    ],
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence(): PresenceState {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}
