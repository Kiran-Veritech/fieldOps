// Priority + project/task status token maps, lifted from the design reference.

export const PRIORITY: Record<string, { color: string; border: string }> = {
  HIGH: { color: '#FBBF3B', border: 'rgba(244,165,33,0.4)' },
  MEDIUM: { color: '#7DB0FF', border: 'rgba(59,130,246,0.4)' },
  LOW: { color: '#94A0B4', border: '#2A3A52' },
}
export const PRIORITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const

export const PROJECT_STATUS: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: '#3FD07E', label: 'ACTIVE' },
  AT_RISK: { color: '#FF6A5E', label: 'AT RISK' },
  PLANNING: { color: '#7DB0FF', label: 'PLANNING' },
  COMPLETED: { color: '#5BC7BB', label: 'COMPLETED' },
}

// Task board columns in order, with their accent colours.
export const TASK_COLUMNS: { key: string; name: string; color: string }[] = [
  { key: 'PENDING', name: 'PENDING', color: '#F4A521' },
  { key: 'IN_PROGRESS', name: 'IN PROGRESS', color: '#3B82F6' },
  { key: 'BLOCKED', name: 'BLOCKED', color: '#F04438' },
  { key: 'COMPLETED', name: 'COMPLETED', color: '#3FD07E' },
]

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toISOString().slice(0, 10)
}

export function weeksBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, Math.round(ms / (7 * 86_400_000)))
}
