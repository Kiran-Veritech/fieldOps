// Shapes mirrored from the backend Pydantic schemas / stored documents.

export type GeoPoint = { lat: number; lng: number }

export type Me = {
  id: string
  fullName: string
  workEmail: string
  designation: string
  category: string
  role: string
  deviceId: string
  appVersion: string
  status: string
  lastPingAt: string | null
  lastLocation: GeoPoint | null
  initialLocation: (GeoPoint & { capturedAt?: string }) | null
  createdAt: string | null
  flags: { type: string; detail: string; at: string }[]
  online: boolean
}

export type Tokens = { accessToken: string; refreshToken: string; tokenType?: string }
export type AuthResponse = { user: Me; tokens: Tokens }

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED'
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

export type Task = {
  _id: string
  projectId: string
  title: string
  description: string
  assigneeId: string | null
  priority: Priority
  dueDate: string | null
  status: TaskStatus
  blockedReason: string | null
  source: 'ai' | 'manual'
  createdAt: string
  updatedAt: string
}

export type AssetStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type Asset = {
  _id: string
  ownerId: string
  name: string
  type: string
  serialNumber: string
  description: string
  photoUrl: string | null
  status: AssetStatus
  adminNote: string | null
  reviewedAt: string | null
  createdAt: string
}

export type ProjectLite = {
  _id: string
  code: string
  name: string
  status: string
  priority: Priority | null
}
