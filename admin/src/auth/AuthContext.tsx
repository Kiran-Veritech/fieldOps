import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, clearTokens, getToken, login as apiLogin } from '../lib/api'

// Until the dedicated Login screen (Admin Utility Screens) is built, the admin
// app bootstraps a session with the seeded demo admin so the authenticated
// screens work. Swap this for the real login form later.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL ?? 'tara.singh@fieldops.io'
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? 'FieldOps!23'

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
        if (getToken()) {
          // Validate the stored session (the client auto-refreshes an expired
          // access token). If it can't be revived, fall back to a fresh login
          // so we never get stuck with a dead token.
          try {
            const me = await api<Admin>('/auth/whoami')
            if (!cancelled) setAdmin(me)
          } catch {
            clearTokens()
            await doLogin(DEMO_EMAIL, DEMO_PASSWORD)
          }
        } else {
          await doLogin(DEMO_EMAIL, DEMO_PASSWORD)
        }
      } catch (e) {
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
