// Small display helpers shared across the field-app screens.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** API datetimes are UTC — add Z when the backend omitted timezone. */
export function parseApiDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const s = String(iso).trim()
  if (!s) return null
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s)
  const d = new Date(hasTz ? s : `${s}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "JUL 20" style due-date label used on task cards and the detail sheet. */
export function dueLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = parseApiDate(iso) ?? new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function isoDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = parseApiDate(iso) ?? new Date(iso)
  return d.toISOString().slice(0, 10)
}

export function secondsSince(iso: string | null | undefined): number | null {
  const d = parseApiDate(iso)
  if (!d) return null
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
}

/** "3s ago" / "4m ago" / "2h ago" compact relative time. */
export function timeAgo(iso: string | null | undefined): string {
  const s = secondsSince(iso)
  if (s === null) return 'never'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
