import type { AssetStatus, Priority, TaskStatus } from '../types'

// Status + priority colour tokens lifted verbatim from the app design reference.

export const TASK_STATUS: Record<TaskStatus, { color: string; bg: string; label: string }> = {
  PENDING: { color: '#FBBF3B', bg: 'rgba(244,165,33,0.12)', label: 'PENDING' },
  IN_PROGRESS: { color: '#7DB0FF', bg: 'rgba(59,130,246,0.12)', label: 'IN PROGRESS' },
  BLOCKED: { color: '#FF8A80', bg: 'rgba(240,68,56,0.12)', label: 'BLOCKED' },
  COMPLETED: { color: '#5BE59A', bg: 'rgba(34,197,94,0.12)', label: 'COMPLETED' },
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  HIGH: '#FBBF3B',
  MEDIUM: '#7DB0FF',
  LOW: '#94A0B4',
}

export const ASSET_STATUS: Record<AssetStatus, { color: string; bg: string; label: string }> = {
  PENDING: { color: '#FBBF3B', bg: 'rgba(244,165,33,0.12)', label: 'PENDING' },
  APPROVED: { color: '#5BE59A', bg: 'rgba(34,197,94,0.12)', label: 'APPROVED' },
  REJECTED: { color: '#FF8F94', bg: 'rgba(229,72,77,0.12)', label: 'REJECTED' },
}

export const ASSET_TYPES = ['Camera', 'Tool', 'Device', 'Equipment', 'Vehicle', 'Other'] as const
