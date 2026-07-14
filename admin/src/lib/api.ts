const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const BASE = `${API_URL}/api/v1`

const TOKEN_KEY = 'fon.accessToken'
const REFRESH_KEY = 'fon.refreshToken'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(TOKEN_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Single-flight refresh so a burst of 401s triggers only one /auth/refresh.
let refreshInFlight: Promise<boolean> | null = null

export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        clearTokens()
        return false
      }
      const data = (await res.json()) as { accessToken: string; refreshToken?: string }
      setTokens(data.accessToken, data.refreshToken)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

type Options = {
  method?: string
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
  _retried?: boolean
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal, _retried = false } = opts
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  // Access token likely expired — refresh once and replay the request.
  if (res.status === 401 && auth && !_retried && getRefreshToken()) {
    const ok = await refreshAccessToken()
    if (ok) return api<T>(path, { ...opts, _retried: true })
  }

  const text = await res.text()
  const payload = text ? JSON.parse(text) : null
  if (!res.ok) {
    const detail =
      (payload && typeof payload === 'object' && 'detail' in payload && payload.detail) ||
      res.statusText
    throw new ApiError(res.status, payload, typeof detail === 'string' ? detail : res.statusText)
  }
  return payload as T
}

export async function login(workEmail: string, password: string) {
  const res = await api<{
    user: Record<string, unknown>
    tokens: { accessToken: string; refreshToken: string }
  }>('/auth/login', { method: 'POST', body: { workEmail, password }, auth: false })
  setTokens(res.tokens.accessToken, res.tokens.refreshToken)
  return res.user
}
