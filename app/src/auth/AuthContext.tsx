import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, clearTokens, loadTokens, setUnauthorizedHandler } from '../lib/api'
import type { Me } from '../types'

type AuthState = {
  ready: boolean
  me: Me | null
  setMe: (me: Me) => void
  refreshMe: () => Promise<Me | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<Me | null>(null)

  const signOut = useCallback(async () => {
    await clearTokens()
    setMe(null)
  }, [])

  const refreshMe = useCallback(async (): Promise<Me | null> => {
    try {
      const fresh = await api<Me>('/me')
      setMe(fresh)
      return fresh
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null)
      void clearTokens()
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const tokens = await loadTokens()
        if (tokens) {
          try {
            const fresh = await api<Me>('/me')
            if (!cancelled) setMe(fresh)
          } catch {
            await clearTokens()
            if (!cancelled) setMe(null)
          }
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ ready, me, setMe, refreshMe, signOut }),
    [ready, me, refreshMe, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
