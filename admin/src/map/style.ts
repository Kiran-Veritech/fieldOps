import type { StyleSpecification } from 'maplibre-gl'

/**
 * Live Map basemaps — all MapLibre-compatible, no API key required.
 * Optional override: VITE_MAP_STYLE_URL forces a single custom dark style URL.
 */
export type BasemapMode = 'dark' | 'light' | 'satellite'

const CUSTOM =
  (import.meta.env.VITE_MAP_STYLE_URL as string | undefined)?.trim() || null

export const BASEMAP_STYLES: Record<BasemapMode, string | StyleSpecification> = {
  dark:
    CUSTOM ||
    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  // Esri World Imagery raster + demotiles glyphs so cluster labels still render
  satellite: {
    version: 8,
    name: 'Satellite',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'esri-sat', type: 'raster', source: 'esri', minzoom: 0, maxzoom: 22 }],
  },
}

/** Gurugram / Delhi NCR — matches seed CITY centre */
export const DEFAULT_VIEW = {
  longitude: 77.0266,
  latitude: 28.4595,
  zoom: 11.2,
} as const
