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
import { AppState, Linking, type AppStateStatus } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import type { GeoPoint } from '../types'

const PING_INTERVAL_MS = 10_000

type PresenceState = {
  sharing: boolean
  setSharing: (on: boolean) => void
  lastPingAt: number | null
  lastLocation: GeoPoint | null
  hasPermission: boolean
  canAskAgain: boolean
  requestPermission: () => Promise<boolean>
  openSystemSettings: () => Promise<void>
  enableSharing: () => Promise<boolean>
  pingNow: () => Promise<void>
}

const PresenceContext = createContext<PresenceState | null>(null)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [sharing, setSharingState] = useState(true)
  const [lastPingAt, setLastPingAt] = useState<number | null>(null)
  const [lastLocation, setLastLocation] = useState<GeoPoint | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [canAskAgain, setCanAskAgain] = useState(true)
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
      if (!on) {
        setSharingState(false)
        return
      }
      void enableSharing()
    },
    [enableSharing],
  )

  const pingNow = useCallback(async (): Promise<void> => {
    if (!me) return
    let coords: GeoPoint | null = null
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch {
      // Fall back to the last known / initial fix so a ping still lands.
      coords = lastLocation ?? me.lastLocation ?? me.initialLocation ?? null
    }
    if (!coords) return
    try {
      await api('/pings', { method: 'POST', body: coords })
      setLastLocation(coords)
      setLastPingAt(Date.now())
    } catch {
      // swallow — the sync indicator will read stale until the next tick
    }
  }, [me, lastLocation])

  // The ping loop: runs only while signed in, sharing, permissioned, and foregrounded.
  useEffect(() => {
    if (!me || !sharing || !hasPermission) return
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
      }
    })

    if (appActive.current) start()

    return () => {
      stop()
      sub.remove()
    }
  }, [me, sharing, hasPermission, pingNow, syncPermission])

  // On session start: read permission; if sharing is on and we can still ask, prompt once.
  useEffect(() => {
    if (!me) {
      promptedRef.current = false
      return
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
  }, [me, sharing, syncPermission, requestPermission])

  const value = useMemo<PresenceState>(
    () => ({
      sharing,
      setSharing,
      lastPingAt,
      lastLocation,
      hasPermission,
      canAskAgain,
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
