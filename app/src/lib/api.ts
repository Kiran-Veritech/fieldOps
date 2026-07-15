import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AuthResponse, Tokens } from '../types'

// iOS simulator / web reach the host via localhost. For a physical device set
// EXPO_PUBLIC_API_URL to the machine's LAN IP (see app/.env.example).
export const ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
// REST routes are mounted under /api/v1; uploads are served from the origin.
export const BASE = `${ORIGIN}/api/v1`

const ACCESS_KEY = 'fon.accessToken'
const REFRESH_KEY = 'fon.refreshToken'

let accessToken: string | null = null
let refreshToken: string | null = null

/** Called when the session is unrecoverable so AuthContext can clear `me`. */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

function notifyUnauthorized() {
  onUnauthorized?.()
}

export async function loadTokens(): Promise<Tokens | null> {
  const [a, r] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
  ])
  accessToken = a
  refreshToken = r
  return a && r ? { accessToken: a, refreshToken: r } : null
}

export async function setTokens(tokens: Tokens): Promise<void> {
  accessToken = tokens.accessToken
  refreshToken = tokens.refreshToken
  await AsyncStorage.multiSet([
    [ACCESS_KEY, tokens.accessToken],
    [REFRESH_KEY, tokens.refreshToken],
  ])
}

export async function clearTokens(): Promise<void> {
  accessToken = null
  refreshToken = null
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY])
}

export function hasSession(): boolean {
  return !!accessToken
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

// Single-flight refresh so a burst of 401s triggers only one /auth/refresh.
let refreshInFlight: Promise<boolean> | null = null

async function refreshAccess(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    if (!refreshToken) return false
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        await clearTokens()
        return false
      }
      const data = (await res.json()) as Tokens
      await setTokens(data)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

type Options = {
  method?: string
  body?: unknown
  auth?: boolean
  _retried?: boolean
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, _retried = false } = opts

  if (auth && !accessToken && !refreshToken) {
    notifyUnauthorized()
    throw new ApiError(401, null, 'Not signed in')
  }

  // Access expired but refresh still present — try once before the real call.
  if (auth && !accessToken && refreshToken && !_retried) {
    const ok = await refreshAccess()
    if (!ok) {
      notifyUnauthorized()
      throw new ApiError(401, null, 'Session expired')
    }
  }

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if ((res.status === 401 || res.status === 403) && auth && !_retried && refreshToken) {
    const ok = await refreshAccess()
    if (ok) return api<T>(path, { ...opts, _retried: true })
    notifyUnauthorized()
  }

  if ((res.status === 401 || res.status === 403) && auth && !_retried && !refreshToken) {
    await clearTokens()
    notifyUnauthorized()
  }

  const payload = await parse(res)
  if (!res.ok) {
    const detail =
      (payload && typeof payload === 'object' && 'detail' in payload && (payload as { detail: unknown }).detail) ||
      res.statusText
    throw new ApiError(res.status, payload, typeof detail === 'string' ? detail : res.statusText)
  }
  return payload as T
}

// --- auth helpers -----------------------------------------------------------

export async function register(body: {
  workEmail: string
  fullName: string
  designation: string
  deviceId: string
  deviceName: string
  appVersion: string
  initialLocation: { lat: number; lng: number }
  password: string
}): Promise<AuthResponse> {
  const res = await api<AuthResponse>('/auth/register', { method: 'POST', body, auth: false })
  await setTokens(res.tokens)
  return res
}

export async function login(
  workEmail: string,
  password: string,
  device?: { deviceId: string; deviceName: string },
): Promise<AuthResponse> {
  const res = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: {
      workEmail,
      password,
      ...(device ?? {}),
    },
    auth: false,
  })
  await setTokens(res.tokens)
  return res
}

// --- multipart (asset enlist with an optional photo) ------------------------

export async function enlistAsset(fields: {
  name: string
  type: string
  serialNumber: string
  description: string
  photoUri?: string | null
}): Promise<unknown> {
  const form = new FormData()
  form.append('name', fields.name)
  form.append('type', fields.type)
  form.append('serialNumber', fields.serialNumber)
  form.append('description', fields.description)
  if (fields.photoUri) {
    const name = fields.photoUri.split('/').pop() || 'photo.jpg'
    const ext = name.split('.').pop()?.toLowerCase() || 'jpg'
    // React Native FormData file shape.
    form.append('photo', {
      uri: fields.photoUri,
      name,
      type: ext === 'png' ? 'image/png' : 'image/jpeg',
    } as unknown as Blob)
  }

  if (!accessToken && refreshToken) {
    await refreshAccess()
  }
  if (!accessToken) {
    notifyUnauthorized()
    throw new ApiError(401, null, 'Not signed in')
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }

  let res = await fetch(`${BASE}/assets`, { method: 'POST', headers, body: form })
  if ((res.status === 401 || res.status === 403) && refreshToken) {
    const ok = await refreshAccess()
    if (ok && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
      res = await fetch(`${BASE}/assets`, { method: 'POST', headers, body: form })
    } else {
      notifyUnauthorized()
    }
  }
  const payload = await parse(res)
  if (!res.ok) {
    const detail =
      (payload && typeof payload === 'object' && 'detail' in payload && (payload as { detail: unknown }).detail) ||
      res.statusText
    throw new ApiError(res.status, payload, typeof detail === 'string' ? detail : 'Upload failed')
  }
  return payload
}

/** Absolute URL for an uploaded photo path like "/uploads/xyz.jpg". */
export function assetPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return path.startsWith('http') ? path : `${ORIGIN}${path}`
}
