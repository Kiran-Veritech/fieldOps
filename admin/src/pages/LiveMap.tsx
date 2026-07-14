import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { api } from '../lib/api'
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_TAG,
  type CategoryKey,
  designationColor,
} from '../data/designations'
import { DEFAULT_VIEW, BASEMAP_STYLES, type BasemapMode } from '../map/style'
import { useChrome, useGlobalSearch, type SearchHit } from '../components/shell/chrome'

type Geo = { lat: number; lng: number }
type User = {
  id: string
  fullName: string
  workEmail: string
  designation: string
  category: CategoryKey
  deviceId: string
  status: string
  lastPingAt: string | null
  lastLocation: Geo | null
  initialLocation: (Geo & { capturedAt?: string }) | null
  createdAt: string | null
  online: boolean
}
type Project = { _id: string; code: string; name: string; memberIds: string[] }
type Detail = {
  user: User
  registration: { deviceId: string; initialLocation: Geo | null; createdAt: string | null }
  locationHistory: { lat: number; lng: number; at: string }[]
}

const POLL_MS = 10_000
const SOURCE_ID = 'operators'
const CLUSTER_LAYER = 'op-clusters'
const CLUSTER_COUNT_LAYER = 'op-cluster-count'
const POINT_LAYER = 'op-unclustered'
const POINT_HALO_LAYER = 'op-unclustered-halo'

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${Math.floor(secs)}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`
  return `${Math.floor(secs / 86400)}d`
}
const coord = (g: Geo | null) => (g ? `${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}` : '—')
const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function LiveMap() {
  const mapRef = useRef<MapRef>(null)
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [counts, setCounts] = useState({ onboarded: 0, online: 0, offline: 0 })
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const fittedRef = useRef(false)

  useChrome({ subtitle: 'GURUGRAM · DELHI NCR', showSearch: true })
  const { searchQuery, setSearchHits, setOnSearchSelect, clearSearch } = useGlobalSearch()

  const [presence, setPresence] = useState<'all' | 'online' | 'offline'>('all')
  const [cats, setCats] = useState<Record<CategoryKey, boolean>>({
    Engineering: true,
    Quality: true,
    Delivery: true,
    Operations: true,
    Business: true,
  })
  const [projectId, setProjectId] = useState<string>('')
  const [projectOpen, setProjectOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [cursor, setCursor] = useState<'default' | 'pointer'>('default')

  // Admin browser GPS — “you are here” + locate-me control
  const [myLoc, setMyLoc] = useState<(Geo & { accuracy?: number }) | null>(null)
  const myLocRef = useRef<(Geo & { accuracy?: number }) | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const [basemap, setBasemap] = useState<BasemapMode>('dark')

  const refresh = useCallback(async () => {
    const [u, p, s] = await Promise.all([
      api<{ items: User[] }>('/users?pageSize=200'),
      api<Project[]>('/projects'),
      api<{ counts: { onboarded: number; online: number; offline: number } }>('/dashboard/summary'),
    ])
    setUsers(u.items)
    setProjects(p)
    setCounts(s.counts)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
    const id = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Continuous browser GPS for the logged-in admin viewer.
  // Prefer network / low-accuracy first — highAccuracy often hangs forever on desktops.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser')
      return
    }
    const apply = (pos: GeolocationPosition) => {
      const next = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
      myLocRef.current = next
      setMyLoc(next)
      setGeoError(null)
      setLocating(false)
    }
    const onErr = (err: GeolocationPositionError) => {
      setLocating(false)
      if (err.code === err.PERMISSION_DENIED) {
        setGeoError('Location permission denied — allow location to use Locate me')
      }
    }
    watchIdRef.current = navigator.geolocation.watchPosition(apply, onErr, {
      enableHighAccuracy: false,
      maximumAge: 30_000,
      timeout: 10_000,
    })
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    api<Detail>(`/users/${selectedId}`)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const memberSet = useMemo(() => {
    if (!projectId) return null
    const proj = projects.find((p) => p._id === projectId)
    return proj ? new Set(proj.memberIds) : new Set<string>()
  }, [projectId, projects])

  const catCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const u of users) c[u.category] = (c[u.category] ?? 0) + 1
    return c
  }, [users])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return users.filter((u) => {
      if (!u.lastLocation) return false
      if (presence === 'online' && !u.online) return false
      if (presence === 'offline' && u.online) return false
      if (!cats[u.category]) return false
      if (memberSet && !memberSet.has(u.id)) return false
      if (q) {
        const hay = `${u.fullName} ${u.workEmail} ${u.designation} ${u.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [users, presence, cats, memberSet, searchQuery])

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: filtered.map((u) => {
        const color = designationColor(u.designation, u.category)
        return {
          type: 'Feature' as const,
          properties: {
            id: u.id,
            name: u.fullName,
            online: u.online ? 1 : 0,
            color,
            category: u.category,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [u.lastLocation!.lng, u.lastLocation!.lat] as [number, number],
          },
        }
      }),
    }),
    [filtered],
  )

  const selected = users.find((u) => u.id === selectedId) ?? null
  const selectedPopup =
    selected?.lastLocation != null
      ? { lng: selected.lastLocation.lng, lat: selected.lastLocation.lat }
      : null

  // Fit once when we have operators with coordinates.
  useEffect(() => {
    if (!mapReady || fittedRef.current || filtered.length === 0) return
    const map = mapRef.current?.getMap()
    if (!map) return
    fittedRef.current = true
    if (filtered.length === 1) {
      const loc = filtered[0].lastLocation!
      map.easeTo({ center: [loc.lng, loc.lat], zoom: 13, duration: 600 })
      return
    }
    let minLng = Infinity
    let minLat = Infinity
    let maxLng = -Infinity
    let maxLat = -Infinity
    for (const u of filtered) {
      const { lat, lng } = u.lastLocation!
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 80, duration: 700, maxZoom: 13 },
    )
  }, [mapReady, filtered])

  const resetFilters = () => {
    setPresence('all')
    setCats({ Engineering: true, Quality: true, Delivery: true, Operations: true, Business: true })
    setProjectId('')
  }

  const flyToOperator = useCallback((loc: Geo) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.easeTo({
      center: [loc.lng, loc.lat],
      zoom: Math.max(map.getZoom(), 14.5),
      duration: 550,
      // Keep pin visible left of the 340px detail drawer
      padding: { top: 48, bottom: 48, left: 48, right: 360 },
    })
  }, [])

  const selectOperator = useCallback(
    (id: string, locHint?: Geo | null) => {
      setSelectedId(id)
      const fromList = users.find((u) => u.id === id)?.lastLocation
      const loc = locHint ?? fromList
      if (loc) flyToOperator(loc)
    },
    [users, flyToOperator],
  )

  // Top-bar search → operators & projects on this map
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      setSearchHits([])
      return
    }
    const hits: SearchHit[] = []
    for (const u of users) {
      const hay = `${u.fullName} ${u.workEmail} ${u.designation} ${u.category}`.toLowerCase()
      if (!hay.includes(q)) continue
      hits.push({
        id: u.id,
        title: u.fullName,
        subtitle: `${u.designation}${u.lastLocation ? ` · ${u.lastLocation.lat.toFixed(4)}, ${u.lastLocation.lng.toFixed(4)}` : ' · no location'}`,
        kind: 'operator',
      })
      if (hits.length >= 12) break
    }
    if (hits.length < 12) {
      for (const p of projects) {
        const hay = `${p.name} ${p.code}`.toLowerCase()
        if (!hay.includes(q)) continue
        hits.push({
          id: p._id,
          title: p.name,
          subtitle: p.code,
          kind: 'project',
        })
        if (hits.length >= 12) break
      }
    }
    setSearchHits(hits)
  }, [searchQuery, users, projects, setSearchHits])

  useEffect(() => {
    setOnSearchSelect((hit) => {
      if (hit.kind === 'operator') {
        selectOperator(hit.id)
        clearSearch()
        return
      }
      // Project → apply filter and fit members
      setProjectId(hit.id)
      const proj = projects.find((p) => p._id === hit.id)
      const memberLocs = users.filter(
        (u) => proj?.memberIds.includes(u.id) && u.lastLocation,
      )
      const map = mapRef.current?.getMap()
      if (map && memberLocs.length) {
        let minLng = Infinity
        let minLat = Infinity
        let maxLng = -Infinity
        let maxLat = -Infinity
        for (const u of memberLocs) {
          const { lat, lng } = u.lastLocation!
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
        }
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: { top: 60, bottom: 60, left: 60, right: 60 }, duration: 700, maxZoom: 13 },
        )
      }
      clearSearch()
    })
    return () => setOnSearchSelect(null)
  }, [setOnSearchSelect, selectOperator, clearSearch, projects, users])

  const onMapClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      const map = e.target as MapLibreMap
      const feats = map.queryRenderedFeatures(e.point, {
        layers: [CLUSTER_LAYER, POINT_LAYER, POINT_HALO_LAYER].filter((id) => map.getLayer(id)),
      })
      if (!feats.length) {
        setSelectedId(null)
        return
      }
      const f = feats[0]
      if (f.layer?.id === CLUSTER_LAYER) {
        const source = map.getSource(SOURCE_ID) as GeoJSONSource
        const clusterId = f.properties?.cluster_id as number
        const zoom = await source.getClusterExpansionZoom(clusterId)
        const geom = f.geometry
        if (geom.type !== 'Point') return
        const [lng, lat] = geom.coordinates as [number, number]
        map.easeTo({ center: [lng, lat], zoom, duration: 450 })
        return
      }
      const id = f.properties?.id as string | undefined
      if (!id) return
      const geom = f.geometry
      const hint =
        geom.type === 'Point'
          ? { lng: (geom.coordinates as [number, number])[0], lat: (geom.coordinates as [number, number])[1] }
          : null
      selectOperator(id, hint)
    },
    [selectOperator],
  )

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = e.target as MapLibreMap
    const layers = [CLUSTER_LAYER, POINT_LAYER, POINT_HALO_LAYER].filter((id) => map.getLayer(id))
    if (!layers.length) return
    const hits = map.queryRenderedFeatures(e.point, { layers })
    setCursor(hits.length ? 'pointer' : 'default')
  }, [])

  const zoomBy = (delta: number) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 })
  }

  /** Google Maps–style “go to my location”. Prefer cached fix — getCurrentPosition with highAccuracy hangs on many desktops. */
  const flyToMe = useCallback((loc: Geo) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.easeTo({
      center: [loc.lng, loc.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 700,
    })
  }, [])

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser')
      return
    }

    // Instant jump if we already have a fix from watchPosition.
    const cached = myLocRef.current
    if (cached) {
      setGeoError(null)
      setLocating(false)
      flyToMe(cached)
      return
    }

    setLocating(true)
    setGeoError(null)

    let settled = false
    const finish = (ok: boolean, loc?: Geo & { accuracy?: number }, message?: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(failSafe)
      setLocating(false)
      if (ok && loc) {
        myLocRef.current = loc
        setMyLoc(loc)
        setGeoError(null)
        flyToMe(loc)
      } else if (message) {
        setGeoError(message)
      }
    }

    // Hard cap — some browsers never fire timeout/error for high-accuracy GPS.
    const failSafe = window.setTimeout(() => {
      finish(false, undefined, 'Location timed out — check browser permission and try again')
    }, 8_000)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish(true, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          finish(false, undefined, 'Location permission denied — allow location in the browser')
          return
        }
        // Soft fallback without high accuracy is already in options; still failed.
        finish(false, undefined, 'Could not read your location')
      },
      { enableHighAccuracy: false, timeout: 6_000, maximumAge: 60_000 },
    )
  }, [flyToMe])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#070C16' }}>
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        mapStyle={BASEMAP_STYLES[basemap]}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        cursor={cursor}
        attributionControl={{ compact: true }}
        onLoad={() => {
          setMapReady(true)
          setMapError(null)
        }}
        onError={(e) => {
          const msg = e.error?.message || 'Map failed to load'
          setMapError(msg)
        }}
        onClick={onMapClick}
        onMouseMove={onMouseMove}
        interactiveLayerIds={[CLUSTER_LAYER, POINT_LAYER, POINT_HALO_LAYER]}
      >
        <Source
          id={SOURCE_ID}
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={14}
          clusterRadius={52}
        >
          <Layer
            id={CLUSTER_LAYER}
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                'rgba(22,192,174,0.22)',
                15,
                'rgba(22,192,174,0.28)',
                20,
                'rgba(22,192,174,0.34)',
              ],
              'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 20, 30],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': [
                'step',
                ['get', 'point_count'],
                '#0B7A6F',
                15,
                '#16C0AE',
              ],
            }}
          />
          <Layer
            id={CLUSTER_COUNT_LAYER}
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 13,
            }}
            paint={{ 'text-color': '#7BF0E2' }}
          />
          <Layer
            id={POINT_HALO_LAYER}
            type="circle"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'online'], 1]]}
            paint={{
              'circle-radius': 13,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.18,
            }}
          />
          <Layer
            id={POINT_LAYER}
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': [
                'case',
                ['==', ['get', 'id'], selectedId ?? ''],
                9,
                6.5,
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'online'], 1],
                ['get', 'color'],
                '#0B1220',
              ],
              'circle-stroke-width': [
                'case',
                ['==', ['get', 'id'], selectedId ?? ''],
                3,
                ['==', ['get', 'online'], 1],
                2,
                2,
              ],
              'circle-stroke-color': [
                'case',
                ['==', ['get', 'id'], selectedId ?? ''],
                '#16C0AE',
                ['==', ['get', 'online'], 1],
                '#04060B',
                ['get', 'color'],
              ],
              'circle-opacity': [
                'case',
                ['==', ['get', 'online'], 1],
                1,
                0.78,
              ],
            }}
          />
        </Source>

        {selected && selectedPopup && (
          <>
            <Marker longitude={selectedPopup.lng} latitude={selectedPopup.lat} anchor="bottom">
              <div
                title={`${selected.fullName} · last location`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  transform: 'translateY(4px)',
                }}
              >
                <div
                  style={{
                    background: '#0E1626',
                    border: '1.5px solid #16C0AE',
                    borderRadius: 2,
                    padding: '5px 9px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.55)',
                    whiteSpace: 'nowrap',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#F0F4FA' }}>{selected.fullName}</div>
                  <div className="mono" style={{ fontSize: 9, color: '#5BC7BB', letterSpacing: '0.04em', marginTop: 2 }}>
                    {coord(selected.lastLocation)}
                  </div>
                </div>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: designationColor(selected.designation, selected.category),
                    border: '3px solid #16C0AE',
                    boxShadow: '0 0 0 4px rgba(22,192,174,0.25), 0 0 16px rgba(22,192,174,0.45)',
                  }}
                />
                <span
                  style={{
                    width: 2,
                    height: 10,
                    background: '#16C0AE',
                    marginTop: -1,
                  }}
                />
              </div>
            </Marker>
          </>
        )}

        {myLoc && (
          <Marker longitude={myLoc.lng} latitude={myLoc.lat} anchor="center">
            <div title="You are here" style={{ position: 'relative', width: 28, height: 28, pointerEvents: 'none' }}>
              {myLoc.accuracy != null && myLoc.accuracy < 800 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: Math.min(Math.max(myLoc.accuracy / 4, 28), 72),
                    height: Math.min(Math.max(myLoc.accuracy / 4, 28), 72),
                    borderRadius: '50%',
                    background: 'rgba(66,133,244,0.14)',
                    border: '1px solid rgba(66,133,244,0.35)',
                  }}
                />
              )}
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#4285F4',
                  border: '3px solid #fff',
                  boxShadow: '0 0 0 2px rgba(66,133,244,0.35), 0 2px 8px rgba(0,0,0,0.45)',
                }}
              />
            </div>
          </Marker>
        )}
      </Map>

      {mapError && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 6,
            background: '#1A0F14',
            border: '1px solid #6B2A36',
            color: '#F0B4BC',
            padding: '8px 14px',
            borderRadius: 2,
            fontSize: 12,
            maxWidth: 420,
            textAlign: 'center',
          }}
        >
          Map tiles failed to load. Check network or set `VITE_MAP_STYLE_URL` in admin/.env.
        </div>
      )}

      {geoError && (
        <div
          style={{
            position: 'absolute',
            top: mapError ? 112 : 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 6,
            background: '#0E1626',
            border: '1px solid #2A3A52',
            color: '#97A6BC',
            padding: '8px 14px',
            borderRadius: 2,
            fontSize: 12,
            maxWidth: 420,
            textAlign: 'center',
          }}
        >
          {geoError}
        </div>
      )}

      <CounterStrip counts={counts} />
      <FilterPanel
        presence={presence}
        setPresence={setPresence}
        cats={cats}
        setCats={setCats}
        catCounts={catCounts}
        reset={resetFilters}
        projects={projects}
        projectId={projectId}
        setProjectId={setProjectId}
        projectOpen={projectOpen}
        setProjectOpen={setProjectOpen}
      />
      <Legend open={legendOpen} toggle={() => setLegendOpen((o) => !o)} />
      <MapChrome
        onIn={() => zoomBy(1)}
        onOut={() => zoomBy(-1)}
        onLocate={locateMe}
        locating={locating}
        hasFix={myLoc != null}
        basemap={basemap}
        setBasemap={setBasemap}
      />

      {selected && detail && (
        <DetailDrawer
          user={selected}
          detail={detail}
          project={projects.find((p) => p.memberIds.includes(selected.id)) ?? null}
          onClose={() => setSelectedId(null)}
          onShowOnMap={() => {
            if (selected.lastLocation) flyToOperator(selected.lastLocation)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Counter strip                                                       */
/* ------------------------------------------------------------------ */
function CounterStrip({ counts }: { counts: { onboarded: number; online: number; offline: number } }) {
  return (
    <div style={{ position: 'absolute', top: 16, left: 'calc(50% - 170px)', transform: 'translateX(-50%)', display: 'flex', background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 5 }}>
      <Metric label="ONBOARDED" value={counts.onboarded} color="#F0F4FA" border />
      <Metric label="ONLINE" value={counts.online} color="#3FD07E" border dot />
      <Metric label="OFFLINE" value={counts.offline} color="#94A0B4" />
    </div>
  )
}
function Metric({ label, value, color, border, dot }: { label: string; value: number; color: string; border?: boolean; dot?: boolean }) {
  return (
    <div style={{ padding: '9px 20px', borderRight: border ? '1px solid #1E2A3D' : undefined, textAlign: 'center' }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: dot ? '#3FD07E' : '#5A6B84', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
        {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 6px #3FD07E' }} />}
        {label}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Filter panel                                                        */
/* ------------------------------------------------------------------ */
function FilterPanel(props: {
  presence: 'all' | 'online' | 'offline'
  setPresence: (p: 'all' | 'online' | 'offline') => void
  cats: Record<CategoryKey, boolean>
  setCats: Dispatch<SetStateAction<Record<CategoryKey, boolean>>>
  catCounts: Record<string, number>
  reset: () => void
  projects: Project[]
  projectId: string
  setProjectId: (id: string) => void
  projectOpen: boolean
  setProjectOpen: (o: boolean) => void
}) {
  const { presence, setPresence, cats, setCats, catCounts, reset, projects, projectId, setProjectId, projectOpen, setProjectOpen } = props
  const seg = (p: 'all' | 'online' | 'offline', last?: boolean) => (
    <div
      onClick={() => setPresence(p)}
      className="mono"
      style={{
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        letterSpacing: '0.05em',
        padding: '7px 0',
        cursor: 'pointer',
        borderRight: last ? undefined : '1px solid #1E2A3D',
        background: presence === p ? '#16C0AE' : 'transparent',
        color: presence === p ? '#04060B' : '#97A6BC',
        fontWeight: presence === p ? 600 : 400,
      }}
    >
      {p.toUpperCase()}
    </div>
  )
  const selectedProject = projects.find((p) => p._id === projectId)

  return (
    <div style={{ position: 'absolute', top: 16, left: 16, width: 250, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 5 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '10px 14px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>FILTERS</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#3DD5C6', cursor: 'pointer' }} onClick={reset}>RESET</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>PRESENCE</div>
        <div style={{ display: 'flex', border: '1px solid #1E2A3D', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
          {seg('all')}
          {seg('online')}
          {seg('offline', true)}
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>DESIGNATION</div>
        <div style={{ marginBottom: 16 }}>
          {CATEGORY_ORDER.map((key) => {
            const on = cats[key]
            const color = CATEGORY_COLOR[key]
            return (
              <div
                key={key}
                className="rowh"
                onClick={() => setCats((s) => ({ ...s, [key]: !s[key] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 2, cursor: 'pointer', opacity: on ? 1 : 0.4 }}
              >
                <span style={{ width: 15, height: 15, flex: 'none', border: `1px solid ${color}`, borderRadius: 2, background: on ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#04060B', fontWeight: 700 }}>
                  {on ? '✓' : ''}
                </span>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} />
                <span style={{ fontSize: 12, color: '#C7D2E1', flex: 1 }}>{CATEGORY_LABEL[key]}</span>
                <span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>{catCounts[key] ?? 0}</span>
              </div>
            )
          })}
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>PROJECT</div>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setProjectOpen(!projectOpen)}
            style={{ fontSize: 12, color: '#C7D2E1', background: '#070C16', border: '1px solid #1E2A3D', borderRadius: 2, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            {selectedProject ? selectedProject.name : 'All projects'}
            <span className="mono" style={{ color: '#5A6B84' }}>▾</span>
          </div>
          {projectOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, zIndex: 20, maxHeight: 200, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              <div className="rowh" onClick={() => { setProjectId(''); setProjectOpen(false) }} style={{ fontSize: 12, color: '#C7D2E1', padding: '8px 12px', cursor: 'pointer' }}>All projects</div>
              {projects.map((p) => (
                <div key={p._id} className="rowh" onClick={() => { setProjectId(p._id); setProjectOpen(false) }} style={{ fontSize: 12, color: '#C7D2E1', padding: '8px 12px', cursor: 'pointer' }}>
                  {p.name} <span className="mono" style={{ fontSize: 10, color: '#5A6B84' }}>· {p.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Legend                                                              */
/* ------------------------------------------------------------------ */
function Legend({ open, toggle }: { open: boolean; toggle: () => void }) {
  return (
    <div style={{ position: 'absolute', bottom: 16, left: 16, width: 250, background: '#0B1220', border: '1px solid #1E2A3D', borderRadius: 2, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 5 }}>
      <div onClick={toggle} className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '10px 14px', background: '#0E1626', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span>LEGEND · DESIGNATION</span>
        <span style={{ color: '#97A6BC' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #1E2A3D' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {CATEGORY_ORDER.map((key) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLOR[key] }} />
                <span style={{ fontSize: 11, color: '#C7D2E1', flex: 1 }}>{CATEGORY_LABEL[key]}</span>
                <span className="mono" style={{ fontSize: 9, color: '#5A6B84' }}>{CATEGORY_TAG[key]}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: '#1E2A3D', margin: '12px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#4C8DFF', boxShadow: '0 0 0 2px #04060B' }} />
                <span style={{ fontSize: 10, color: '#97A6BC' }}>Online</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#0B1220', border: '2px solid #64748B' }} />
                <span style={{ fontSize: 10, color: '#97A6BC' }}>Offline</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#4285F4', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(66,133,244,0.4)' }} />
              <span style={{ fontSize: 10, color: '#97A6BC' }}>You (admin browser)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MapChrome({
  onIn,
  onOut,
  onLocate,
  locating,
  hasFix,
  basemap,
  setBasemap,
}: {
  onIn: () => void
  onOut: () => void
  onLocate: () => void
  locating: boolean
  hasFix: boolean
  basemap: BasemapMode
  setBasemap: (m: BasemapMode) => void
}) {
  const panelW = 64
  const modes: { id: BasemapMode; label: string }[] = [
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'satellite', label: 'Sat' },
  ]
  const chromeBtn: CSSProperties = {
    width: panelW,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#97A6BC',
    cursor: 'pointer',
    fontSize: 16,
    background: '#0B1220',
    padding: 0,
    boxSizing: 'border-box',
  }
  return (
    <div style={{ position: 'absolute', bottom: 16, left: 282, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5, width: panelW }}>
      <div
        style={{
          width: panelW,
          background: '#0B1220',
          border: '1px solid #1E2A3D',
          borderRadius: 2,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {modes.map((m, i) => (
          <button
            key={m.id}
            type="button"
            title={`${m.label} map`}
            onClick={() => setBasemap(m.id)}
            className="mono"
            style={{
              border: 'none',
              borderBottom: i < modes.length - 1 ? '1px solid #1E2A3D' : undefined,
              background: basemap === m.id ? '#16C0AE' : 'transparent',
              color: basemap === m.id ? '#04060B' : '#97A6BC',
              fontSize: 9,
              letterSpacing: '0.08em',
              fontWeight: basemap === m.id ? 700 : 500,
              padding: '7px 0',
              cursor: 'pointer',
              textAlign: 'center',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {m.label.toUpperCase()}
          </button>
        ))}
      </div>
      <div
        style={{
          width: panelW,
          background: '#0B1220',
          border: '1px solid #1E2A3D',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <button type="button" aria-label="Zoom in" className="mono" onClick={onIn} style={{ ...chromeBtn, border: 'none', borderBottom: '1px solid #1E2A3D' }}>
          +
        </button>
        <button type="button" aria-label="Zoom out" className="mono" onClick={onOut} style={{ ...chromeBtn, border: 'none' }}>
          −
        </button>
      </div>
      <button
        type="button"
        title="Locate me"
        onClick={onLocate}
        style={{
          width: panelW,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1220',
          border: `1px solid ${hasFix ? '#4285F4' : '#1E2A3D'}`,
          borderRadius: 2,
          color: hasFix ? '#8AB4F8' : '#97A6BC',
          cursor: locating ? 'wait' : 'pointer',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          padding: 0,
          opacity: locating ? 0.7 : 1,
          boxSizing: 'border-box',
        }}
      >
        <LocateIcon spinning={locating} />
      </button>
    </div>
  )
}

function LocateIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      style={spinning ? { animation: 'fon-spin 0.9s linear infinite' } : undefined}
    >
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                       */
/* ------------------------------------------------------------------ */
function DetailDrawer({
  user,
  detail,
  project,
  onClose,
  onShowOnMap,
}: {
  user: User
  detail: Detail
  project: Project | null
  onClose: () => void
  onShowOnMap: () => void
}) {
  const color = designationColor(user.designation, user.category)
  const catColor = CATEGORY_COLOR[user.category]
  const firstSeen = detail.registration.createdAt ?? user.createdAt
  const pings = detail.locationHistory.slice(0, 5)
  const initials = user.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const loc = user.lastLocation
  const mapsUrl = loc
    ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}`
    : null

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 340, background: '#0B1220', borderLeft: '1px solid #1E2A3D', boxShadow: '-18px 0 44px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 8 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: '#5A6B84', padding: '12px 18px', borderBottom: '1px solid #1E2A3D', background: '#0E1626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>OPERATOR DETAIL</span>
        <span onClick={onClose} style={{ color: '#97A6BC', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>×</span>
      </div>

      <div style={{ padding: '20px 18px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, flex: 'none', borderRadius: 2, background: '#152134', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <span className="mono" style={{ fontSize: 18, fontWeight: 600, color }}>{initials}</span>
            <span style={{ position: 'absolute', bottom: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: user.online ? '#3FD07E' : '#64748B', border: '2px solid #0B1220', boxShadow: user.online ? '0 0 8px #3FD07E' : undefined }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#F0F4FA', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{user.fullName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: catColor }} />
              <span style={{ fontSize: 12, color: '#97A6BC' }}>{user.designation} · {user.category}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {user.online ? (
            <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.06em', color: '#3FD07E', border: '1px solid rgba(63,208,126,0.35)', borderRadius: 2, padding: '5px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3FD07E', boxShadow: '0 0 6px #3FD07E', animation: 'fon-pulse 1.6s infinite' }} />ONLINE
            </span>
          ) : (
            <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '0.06em', color: '#94A0B4', border: '1px solid #1E2A3D', borderRadius: 2, padding: '5px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748B' }} />OFFLINE
            </span>
          )}
          <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, letterSpacing: '0.06em', color: '#97A6BC', border: '1px solid #1E2A3D', borderRadius: 2, padding: '5px 10px' }}>
            SYNC {timeAgo(user.lastPingAt)} AGO
          </span>
        </div>

        {/* Marked last-known location — shown with details on node click */}
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>
          MARKED LOCATION
        </div>
        <div
          style={{
            border: '1px solid #16C0AE',
            borderRadius: 2,
            padding: '12px 14px',
            marginBottom: 16,
            background: 'linear-gradient(180deg, rgba(22,192,174,0.08), transparent)',
          }}
        >
          {loc ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    marginTop: 3,
                    borderRadius: '50%',
                    background: color,
                    border: '2px solid #16C0AE',
                    boxShadow: '0 0 10px rgba(22,192,174,0.5)',
                    flex: 'none',
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FA', letterSpacing: '0.02em' }}>
                    {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: '#5BC7BB', marginTop: 4 }}>
                    Last ping {timeAgo(user.lastPingAt)} ago
                    {user.lastPingAt
                      ? ` · ${new Date(user.lastPingAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}`
                      : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={onShowOnMap}
                  style={{
                    flex: 1,
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#04060B',
                    background: '#16C0AE',
                    border: 'none',
                    borderRadius: 2,
                    padding: '8px 0',
                    cursor: 'pointer',
                  }}
                >
                  Show on map
                </button>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      fontFamily: 'inherit',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#C7D2E1',
                      background: 'transparent',
                      border: '1px solid #2A3A52',
                      borderRadius: 2,
                      padding: '8px 0',
                      cursor: 'pointer',
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    Open in Maps
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="mono" style={{ fontSize: 11, color: '#5A6B84' }}>No location recorded for this operator</div>
          )}
        </div>

        <div style={{ border: '1px solid #1E2A3D', borderRadius: 2, marginBottom: 16 }}>
          <DrawerRow label="DEVICE ID" value={user.deviceId} valueColor="#3DD5C6" />
          <DrawerRow label="COORDINATES" value={coord(user.lastLocation)} />
          <DrawerRow label="FIRST SEEN" value={firstSeen ? new Date(firstSeen).toISOString().slice(0, 16).replace('T', ' ') : '—'} />
          <DrawerRow label="WORK EMAIL" value={user.workEmail} last />
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>ASSIGNED PROJECT</div>
        <div style={{ border: '1px solid #1E2A3D', borderLeft: '2px solid #16C0AE', borderRadius: 2, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EDF4' }}>{project ? project.name : 'No project assigned'}</div>
          {project && <div className="mono" style={{ fontSize: 10, color: '#5A6B84', marginTop: 4 }}>{project.code} · {project.memberIds.length} OPERATORS</div>}
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: '#5A6B84', marginBottom: 8 }}>PING LOG</div>
        <div style={{ border: '1px solid #1E2A3D', borderRadius: 2, padding: '10px 14px', marginBottom: 20 }}>
          {pings.length === 0 && <div className="mono" style={{ fontSize: 10, color: '#5A6B84', padding: '3px 0' }}>No pings recorded</div>}
          {pings.map((p, i) => (
            <div key={i} className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#97A6BC', padding: '3px 0', gap: 8 }}>
              <span style={{ flex: 'none' }}>{clockOf(p.at)}</span>
              <span style={{ color: i === 0 ? '#3FD07E' : '#5A6B84', textAlign: 'right' }}>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid #1E2A3D', background: '#0B1220', display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onShowOnMap}
          style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#04060B', background: '#16C0AE', border: 'none', borderRadius: 2, padding: '11px 0', cursor: 'pointer' }}
        >
          Show on map
        </button>
        <button style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#C7D2E1', background: 'transparent', border: '1px solid #2A3A52', borderRadius: 2, padding: '11px 16px', cursor: 'pointer' }}>Message</button>
      </div>
    </div>
  )
}

function DrawerRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: last ? undefined : '1px solid #152134' }}>
      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#5A6B84' }}>{label}</span>
      <span className="mono" style={{ fontSize: 12, color: valueColor ?? '#C7D2E1' }}>{value}</span>
    </div>
  )
}
