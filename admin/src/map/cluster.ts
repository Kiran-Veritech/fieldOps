import type { Pt } from './projection'

export type Placed<T> = { item: T; pt: Pt }

export type Cluster<T> = {
  x: number
  y: number
  items: Placed<T>[]
}

/**
 * Grid-based clustering in screen-space (% units). Cell size shrinks as zoom
 * grows, so zooming in breaks clusters apart into individual pins — matching
 * the reference's "cluster bubbles → expand to pins" behaviour.
 */
export function clusterPlaced<T>(placed: Placed<T>[], zoom: number): Cluster<T>[] {
  // Smaller cells keep individual pins separate for modest operator counts;
  // clusters only form where markers genuinely overlap, and break apart on zoom.
  const cell = Math.max(4, 9 / zoom) // % of the map box
  const buckets = new Map<string, Placed<T>[]>()

  for (const p of placed) {
    const cx = Math.floor(p.pt.x / cell)
    const cy = Math.floor(p.pt.y / cell)
    const key = `${cx}:${cy}`
    const arr = buckets.get(key)
    if (arr) arr.push(p)
    else buckets.set(key, [p])
  }

  const clusters: Cluster<T>[] = []
  for (const arr of buckets.values()) {
    const x = arr.reduce((s, p) => s + p.pt.x, 0) / arr.length
    const y = arr.reduce((s, p) => s + p.pt.y, 0) / arr.length
    clusters.push({ x, y, items: arr })
  }
  return clusters
}
