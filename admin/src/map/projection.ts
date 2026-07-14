// Projects real lat/lng into the stylized map's viewport. Bounds match the
// seed's NCR_BOUNDS so demo operators land across the Delhi NCR region.

export const NCR_BOUNDS = {
  minLat: 28.4,
  maxLat: 28.72,
  minLng: 76.98,
  maxLng: 77.34,
}

export type Pt = { x: number; y: number } // percentages 0..100 within the map

/**
 * Base projection (equirectangular) into 0..100% of the map box, then apply a
 * zoom + pan transform around a normalized center so +/- zoom spreads points.
 */
export function project(
  lat: number,
  lng: number,
  zoom = 1,
  center: { x: number; y: number } = { x: 50, y: 50 },
): Pt {
  const bx = ((lng - NCR_BOUNDS.minLng) / (NCR_BOUNDS.maxLng - NCR_BOUNDS.minLng)) * 100
  // y is inverted: higher latitude sits nearer the top.
  const by = ((NCR_BOUNDS.maxLat - lat) / (NCR_BOUNDS.maxLat - NCR_BOUNDS.minLat)) * 100

  const x = center.x + (bx - center.x) * zoom
  const y = center.y + (by - center.y) * zoom
  return { x, y }
}

export function inView(pt: Pt, pad = 4): boolean {
  return pt.x >= -pad && pt.x <= 100 + pad && pt.y >= -pad && pt.y <= 100 + pad
}
