export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
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
  if (!iso) return Infinity
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
}

export function initials(name: string | undefined | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function coord(g: { lat: number; lng: number } | null | undefined): string {
  return g ? `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}` : '—'
}
