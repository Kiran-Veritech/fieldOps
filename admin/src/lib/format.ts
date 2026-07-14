/** Parse API timestamps. Backend historically emitted naive UTC without `Z`;
 *  in IST that made every "just now" look like "~5h 30m ago". */
export function parseApiDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const s = String(iso).trim()
  if (!s) return null
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s)
  const d = new Date(hasTz ? s : `${s}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function timeAgo(iso: string | null | undefined): string {
  const d = parseApiDate(iso)
  if (!d) return 'never'
  const secs = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (secs < 60) return `${Math.floor(secs)}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${h}h ${String(m).padStart(2, '0')}m`
  }
  return `${Math.floor(secs / 86400)}d`
}

export function secondsSince(iso: string | null | undefined): number {
  const d = parseApiDate(iso)
  if (!d) return Infinity
  return Math.max(0, (Date.now() - d.getTime()) / 1000)
}

export function initials(name: string | undefined | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function clockOf(iso: string): string {
  const d = parseApiDate(iso) ?? new Date(iso)
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function coord(g: { lat: number; lng: number } | null | undefined): string {
  return g ? `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}` : '—'
}
