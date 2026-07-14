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
import { AppState, type AppStateStatus } from 'react-native'
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
  requestPermission: () => Promise<boolean>
  pingNow: () => Promise<void>
}

const PresenceContext = createContext<PresenceState | null>(null)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const [sharing, setSharing] = useState(true)
  const [lastPingAt, setLastPingAt] = useState<number | null>(null)
  const [lastLocation, setLastLocation] = useState<GeoPoint | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const appActive = useRef(AppState.currentState === 'active')

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    const granted = status === 'granted'
    setHasPermission(granted)
    return granted
  }, [])

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

  // The ping loop: runs only while signed in, sharing, and app foregrounded.
  useEffect(() => {
    if (!me || !sharing) return
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
      if (next === 'active') start()
    })

    if (appActive.current) start()

    return () => {
      stop()
      sub.remove()
    }
  }, [me, sharing, pingNow])

  // Check the current permission grant once we have a session.
  useEffect(() => {
    if (!me) return
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => setHasPermission(status === 'granted'))
      .catch(() => setHasPermission(false))
  }, [me])

  const value = useMemo<PresenceState>(
    () => ({ sharing, setSharing, lastPingAt, lastLocation, hasPermission, requestPermission, pingNow }),
    [sharing, lastPingAt, lastLocation, hasPermission, requestPermission, pingNow],
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence(): PresenceState {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}
