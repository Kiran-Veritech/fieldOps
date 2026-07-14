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
const ONLINE_WINDOW_MS = 60_000

type PresenceState = {
  /** Whether the user has opted to transmit pings (foreground only). */
  sharing: boolean
  setSharing: (on: boolean) => void
  /** Client clock of last successful /pings POST. */
  lastPingAt: number | null
  lastLocation: GeoPoint | null
  hasPermission: boolean
  /** True when sharing and a successful ping landed within 60s. */
  online: boolean
  requestPermission: () => Promise<boolean>
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
    // ignore — try a fresh fix below
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
  const [sharing, setSharing] = useState(true)
  const [lastPingAt, setLastPingAt] = useState<number | null>(null)
  const [lastLocation, setLastLocation] = useState<GeoPoint | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [, setTick] = useState(0)
  const appActive = useRef(AppState.currentState === 'active')
  const lastLocationRef = useRef<GeoPoint | null>(null)

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    const granted = status === 'granted'
    setHasPermission(granted)
    return granted
  }, [])

  const pingNow = useCallback(async (): Promise<boolean> => {
    if (!me) return false

    let permission = hasPermission
    if (!permission) {
      const { status } = await Location.getForegroundPermissionsAsync()
      permission = status === 'granted'
      setHasPermission(permission)
    }
    if (!permission) return false

    // Real GPS only — never re-post a fixed mock / seed location.
    const coords = await readGps()
    if (!coords) return false

    try {
      await api('/pings', { method: 'POST', body: coords })
      lastLocationRef.current = coords
      setLastLocation(coords)
      setLastPingAt(Date.now())
      return true
    } catch {
      return false
    }
  }, [me, hasPermission])

  // When a session appears (register / token restore), seed location state and
  // ensure we have permission so the first ping can land immediately.
  useEffect(() => {
    if (!me) {
      setLastPingAt(null)
      setLastLocation(null)
      lastLocationRef.current = null
      setSharing(true)
      return
    }

    if (me.lastLocation) {
      lastLocationRef.current = me.lastLocation
      setLastLocation(me.lastLocation)
    }
    if (me.lastPingAt) {
      const ts = new Date(me.lastPingAt).getTime()
      if (!Number.isNaN(ts)) setLastPingAt(ts)
    }

    let cancelled = false
    ;(async () => {
      const { status } = await Location.getForegroundPermissionsAsync()
      if (cancelled) return
      if (status === 'granted') {
        setHasPermission(true)
        return
      }
      // Returning users: prompt on session restore so login → ping works.
      const { status: next } = await Location.requestForegroundPermissionsAsync()
      if (!cancelled) setHasPermission(next === 'granted')
    })()

    return () => {
      cancelled = true
    }
  }, [me?.id])

  // Ping loop: signed in + sharing + foreground.
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
      if (next === 'active') {
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
  }, [me, sharing, pingNow])

  // Refresh "online" derived state every second so the pill flips at 60s.
  useEffect(() => {
    if (!me || !sharing) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [me, sharing])

  const online =
    !!me &&
    sharing &&
    lastPingAt !== null &&
    Date.now() - lastPingAt < ONLINE_WINDOW_MS

  const value = useMemo<PresenceState>(
    () => ({
      sharing,
      setSharing,
      lastPingAt,
      lastLocation,
      hasPermission,
      online,
      requestPermission,
      pingNow,
    }),
    [sharing, lastPingAt, lastLocation, hasPermission, online, requestPermission, pingNow],
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence(): PresenceState {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}
