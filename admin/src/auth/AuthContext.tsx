import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, clearTokens, getToken, login as apiLogin } from '../lib/api'

// Until the dedicated Login screen (Admin Utility Screens) is built, the admin
// app bootstraps a session with the seeded demo admin so the authenticated
// screens work. Swap this for the real login form later.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL ?? 'admin@fieldops.io'
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? 'Password123!'

type Admin = { fullName?: string; workEmail?: string } | null

type AuthState = {
  ready: boolean
  admin: Admin
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthCtx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [admin, setAdmin] = useState<Admin>(null)
  const [error, setError] = useState<string | null>(null)

  async function doLogin(email: string, password: string) {
    const user = await apiLogin(email, password)
    setAdmin(user as Admin)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        // Prefer a fresh demo login when the stored session can't talk to the API
        // (expired tokens, or reseed that revoked all user ids). Cap waits so a
        // hung backend can't leave the UI on CONNECTING forever.
        const withTimeout = <T,>(p: Promise<T>, ms = 12_000) =>
          Promise.race([
            p,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Backend timed out')), ms)),
          ])

        if (getToken()) {
          try {
            const me = await withTimeout(api<Admin>('/auth/whoami'))
            if (!cancelled) setAdmin(me)
          } catch {
            clearTokens()
            await withTimeout(doLogin(DEMO_EMAIL, DEMO_PASSWORD))
          }
        } else {
          await withTimeout(doLogin(DEMO_EMAIL, DEMO_PASSWORD))
        }
      } catch (e) {
        clearTokens()
        if (!cancelled) setError(e instanceof Error ? e.message : 'Auth failed')
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  function logout() {
    clearTokens()
    setAdmin(null)
  }

  return (
    <AuthCtx.Provider value={{ ready, admin, error, login: doLogin, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
