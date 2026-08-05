'use client'
/**
 * useMapInit — Core map initialization hook
 *
 * Handles the entire map initialization lifecycle:
 * - Dynamic imports of all OpenLayers modules
 * - Projection registration
 * - Layer creation (basemaps, draw, measure, cluster)
 * - Project data fetching and marker placement
 * - Interaction setup (select, snap, drag-and-drop)
 * - View state restoration from localStorage
 * - Proper cleanup on unmount
 *
 * Performance optimizations:
 * - All OL modules loaded in parallel via Promise.all
 * - Project markers use Cluster source (distance: 40, minDistance: 20)
 * - Mouse position throttled to 100ms
 * - Map view state saved every 10s (not on every move)
 * - Tile cache size set to 2048 for better caching
 */

import { useEffect } from 'react'
import type { MapCleanupRefs } from '@/lib/map/olTypes'
import type OLMapType from 'ol/Map'
import type { SelectEvent } from 'ol/interaction/Select'
import type { BasemapModules } from './useMapBasemaps'
import type { DragAndDropEvent } from 'ol/interaction/DragAndDrop'

interface UseMapInitParams {
  mapRef: React.RefObject<HTMLDivElement | null>
  setMapReady: (v: boolean) => void
  setInitError: (v: string) => void
  setProjectCount: (v: number) => void
  setMouseCoord: (v: { lon: number; lat: number; e: number; n: number } | null) => void
  setFeatureCount: (v: number) => void
  setImportMsg: (v: string) => void
  setSelectedFeature: (v: import('ol/Feature').default | null) => void
  setFeatureName: (v: string) => void
  mouseCoordThrottleRef: React.MutableRefObject<number>
  searchParams: URLSearchParams
  pushHistory: () => void
  drawSourceRef: React.MutableRefObject<unknown>
  drawLayerRef: React.MutableRefObject<unknown>
  measureSourceRef: React.MutableRefObject<unknown>
  measureLayerRef: React.MutableRefObject<unknown>
  selectInteractionRef: React.MutableRefObject<unknown>
  mapInstance: React.MutableRefObject<unknown>
  cleanupRef: React.MutableRefObject<MapCleanupRefs | null>
  popupRef: React.MutableRefObject<HTMLDivElement | null>
  createBasemaps: (olModules: BasemapModules) => Record<string, import('ol/layer/Tile').default>
  onPopupRender: (popupElement: HTMLDivElement, data: { coordinate?: import('ol/coordinate').Coordinate; projectName?: string; stationName?: string; geometryType?: string; projectId?: string }, hidePopup: () => void) => void
  /** T1.5 FIX (2026-07-09): UTM EPSG for mouse position coordinate display */
  currentUtmEpsg?: string
}

export function useMapInit(params: UseMapInitParams) {
  const {
    mapRef, setMapReady, setInitError, setProjectCount,
    setMouseCoord, setFeatureCount, setImportMsg,
    setSelectedFeature, setFeatureName, mouseCoordThrottleRef,
    searchParams, pushHistory,
    drawSourceRef, drawLayerRef, measureSourceRef, measureLayerRef,
    selectInteractionRef, mapInstance, cleanupRef, popupRef,
    createBasemaps, onPopupRender,
  } = params

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    let map: OLMapType | null = null
    let cancelled = false
    const olModules: {
      VectorSource?: typeof import('ol/source/Vector').default
      VectorLayer?: typeof import('ol/layer/Vector').default
      Feature?: typeof import('ol/Feature').default
      Point?: typeof import('ol/geom/Point').default
      Polygon?: typeof import('ol/geom/Polygon').default
      LineString?: typeof import('ol/geom/LineString').default
      CircleGeom?: typeof import('ol/geom/Circle').default
      Style?: typeof import('ol/style/Style').default
      Fill?: typeof import('ol/style/Fill').default
      Stroke?: typeof import('ol/style/Stroke').default
      CircleStyle?: typeof import('ol/style/Circle').default
      Text?: typeof import('ol/style/Text').default
      proj?: typeof import('ol/proj')
      Draw?: typeof import('ol/interaction/Draw').default
      Modify?: typeof import('ol/interaction/Modify').default
      Snap?: typeof import('ol/interaction/Snap').default
      TileLayer?: typeof import('ol/layer/Tile').default
      OSM?: typeof import('ol/source/OSM').default
      XYZ?: typeof import('ol/source/XYZ').default
      Cluster?: typeof import('ol/source/Cluster').default
    } = {}

    async function initMap() {
      try {
        // Register projections with error handling
        try {
          const { registerProjections } = await import('@/lib/map/projection')
          await registerProjections()
        } catch (projErr) {
          console.warn('Projection registration failed, using defaults:', projErr)
        }

        // Parallel import of all OL modules for performance
        const imports = await Promise.all([
          import('ol/Map'),
          import('ol/View'),
          import('ol/layer/Tile'),
          import('ol/layer/Vector'),
          import('ol/layer/Group'),
          import('ol/source/OSM'),
          import('ol/source/XYZ'),
          import('ol/source/Vector'),
          import('ol/source/Cluster'),
          import('ol/Feature'),
          import('ol/geom/Point'),
          import('ol/geom/Polygon'),
          import('ol/geom/Circle'),
          import('ol/geom/LineString'),
          import('ol/style/Style'),
          import('ol/style/Fill'),
          import('ol/style/Stroke'),
          import('ol/style/Circle'),
          import('ol/style/Text'),
          import('ol/style/Icon'),
          import('ol/control/ScaleLine'),
          import('ol/control/Attribution'),
          import('ol/control/MousePosition'),
          import('ol/interaction/Draw'),
          import('ol/interaction/Select'),
          import('ol/interaction/Snap'),
          import('ol/interaction/Modify'),
          import('ol/interaction/DragAndDrop'),
          import('ol/interaction/DragRotate'),
          import('ol/interaction/PinchRotate'),
          import('ol/Overlay'),
          import('ol/Geolocation'),
          import('ol/format/GeoJSON'),
          import('ol/format/KML'),
          import('ol/format/WKT'),
        ])

        const [projModule] = await Promise.all([import('ol/proj')])
        const proj = projModule as typeof import('ol/proj')

        const [Map, View, TileLayer, VectorLayer, _LayerGroup, OSM, XYZ, VectorSource,
          Cluster, Feature, Point, Polygon, CircleGeom, LineString, Style, Fill, Stroke,
          CircleStyle, Text, _Icon, ScaleLine, Attribution, MousePosition,
          Draw, Select, Snap, Modify, DragAndDrop, DragRotate, PinchRotate, Overlay, Geolocation,
          GeoJSONFormat, KMLFormat, WKTFormat] = imports.map(i => ('default' in i ? i.default : i)) as [
          typeof import('ol/Map').default, typeof import('ol/View').default,
          typeof import('ol/layer/Tile').default, typeof import('ol/layer/Vector').default,
          typeof import('ol/layer/Group').default, typeof import('ol/source/OSM').default,
          typeof import('ol/source/XYZ').default, typeof import('ol/source/Vector').default,
          typeof import('ol/source/Cluster').default, typeof import('ol/Feature').default,
          typeof import('ol/geom/Point').default, typeof import('ol/geom/Polygon').default,
          typeof import('ol/geom/Circle').default, typeof import('ol/geom/LineString').default,
          typeof import('ol/style/Style').default, typeof import('ol/style/Fill').default,
          typeof import('ol/style/Stroke').default, typeof import('ol/style/Circle').default,
          typeof import('ol/style/Text').default, typeof import('ol/style/Icon').default,
          typeof import('ol/control/ScaleLine').default, typeof import('ol/control/Attribution').default,
          typeof import('ol/control/MousePosition').default,
          typeof import('ol/interaction/Draw').default, typeof import('ol/interaction/Select').default,
          typeof import('ol/interaction/Snap').default, typeof import('ol/interaction/Modify').default,
          typeof import('ol/interaction/DragAndDrop').default, typeof import('ol/interaction/DragRotate').default,
          typeof import('ol/interaction/PinchRotate').default, typeof import('ol/Overlay').default,
          typeof import('ol/Geolocation').default, typeof import('ol/format/GeoJSON').default,
          typeof import('ol/format/KML').default, typeof import('ol/format/WKT').default
        ]

        olModules.VectorSource = VectorSource
        olModules.VectorLayer = VectorLayer
        olModules.Feature = Feature
        olModules.Point = Point
        olModules.Polygon = Polygon
        olModules.LineString = LineString
        olModules.CircleGeom = CircleGeom
        olModules.Style = Style
        olModules.Fill = Fill
        olModules.Stroke = Stroke
        olModules.CircleStyle = CircleStyle
        olModules.Text = Text
        olModules.proj = proj
        olModules.Draw = Draw
        olModules.Modify = Modify
        olModules.Snap = Snap
        olModules.TileLayer = TileLayer
        olModules.OSM = OSM
        olModules.XYZ = XYZ
        olModules.Cluster = Cluster

        if (cancelled || !mapRef.current) return

        // ── Basemap layers ──
        // TileLayer/OSM/XYZ are assigned above — the cast is safe only after those assignments.
        const basemaps = createBasemaps(olModules as BasemapModules)

        // ── Draw layer — using enhanced SoK-compliant styles ──
        const drawSource = new VectorSource()
        drawSourceRef.current = drawSource

        // Dynamic import of enhanced styles (SoK-compliant, zoom-aware)
        const { getStyleForFeature } = await import('@/lib/map/enhancedStyles')

        const drawLayer = new VectorLayer({
          source: drawSource,
          // Use a style function that adapts to feature type + zoom
          style: (feature: import('ol/Feature').FeatureLike, resolution: number) => {
            // For drawn features, use the enhanced SoK style
            const geomType = feature.getGeometry()?.getType()
            if (geomType === 'Polygon') {
              return getStyleForFeature(feature as InstanceType<typeof Feature>, resolution)
            }
            // Default style for points/lines being drawn
            return new Style({
              fill: new Fill({ color: 'rgba(209, 123, 71, 0.15)' }),
              stroke: new Stroke({ color: '#D17B47', width: 2.5 }),
              image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#D17B47' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
            })
          },
          zIndex: 50,
        })
        drawLayerRef.current = drawLayer

        // ── Measure layer ──
        const measureSource = new VectorSource()
        measureSourceRef.current = measureSource
        const measureLayer = new VectorLayer({
          source: measureSource,
          style: new Style({
            fill: new Fill({ color: 'rgba(96, 165, 250, 0.15)' }),
            stroke: new Stroke({ color: '#60a5fa', width: 2, lineDash: [6, 4] }),
            image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#60a5fa' }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }),
          }),
          zIndex: 45,
        })
        measureLayerRef.current = measureLayer

        // ── Cluster layer for projects ──
        const projectSource = new VectorSource()
        const clusterSource = new Cluster({
          distance: 40,
          minDistance: 20,
          source: projectSource,
        })
        const clusterLayer = new VectorLayer({
          source: clusterSource,
          style: (feature: import('ol/Feature').FeatureLike) => {
            const size = (feature.get('features') as unknown[] | undefined)?.length || 1
            return new Style({
              image: new CircleStyle({
                radius: size > 1 ? 12 + Math.min(size * 2, 20) : 8,
                fill: new Fill({ color: size > 1 ? 'rgba(209, 123, 71,0.8)' : '#D17B47' }),
                stroke: new Stroke({ color: '#fff', width: 2 }),
              }),
              text: new Text({
                text: size > 1 ? String(size) : '',
                font: 'bold 12px sans-serif',
                fill: new Fill({ color: '#fff' }),
              }),
            })
          },
          zIndex: 10,
        })

        // ── Fetch projects ──
        try {
          const { createClient } = await import('@/lib/api-client/client')
          const dbClient = createClient()
          const { data: { session } } = await dbClient.auth.getSession()

          if (session?.user) {
            const { data } = (await dbClient
              .from('projects')
              .select('id, name, location, utm_zone, hemisphere, survey_type, boundary_data')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })) as { data: Array<{
                id: string | number
                name: string
                location?: string | null
                utm_zone?: number | null
                hemisphere?: string | null
                survey_type?: string | null
                boundary_data?: { adjustedStations?: Array<{ easting?: string | number; E?: string | number; e?: string | number; northing?: string | number; N?: string | number; n?: string | number }>; stations?: Array<{ easting?: string | number; E?: string | number; e?: string | number; northing?: string | number; N?: string | number; n?: string | number }> } | null
              }> | null } | { data: null }

            const projects = data || []
            setProjectCount(projects.length)

            for (const project of projects) {
              const bd = project.boundary_data
              const adjustedStations = bd?.adjustedStations || bd?.stations || []
              if (adjustedStations.length === 0) continue

              const projCode = 'EPSG:21037'
              const validCoords = adjustedStations
                .map((s) => [parseFloat(String(s.easting || s.E || s.e)), parseFloat(String(s.northing || s.N || s.n))])
                .filter((c: number[]) => !isNaN(c[0]) && !isNaN(c[1]))

              if (validCoords.length === 0) continue
              const avgE = validCoords.reduce((s: number, c: number[]) => s + c[0], 0) / validCoords.length
              const avgN = validCoords.reduce((s: number, c: number[]) => s + c[1], 0) / validCoords.length

              try {
                const coords3857 = proj.transform([avgE, avgN], projCode, 'EPSG:3857')
                const feature = new Feature({
                  geometry: new Point(coords3857),
                  projectName: project.name,
                  stationCount: validCoords.length,
                  surveyType: project.survey_type || 'cadastral',
                })
                feature.set('projectId', project.id)
                projectSource.addFeature(feature)
              } catch { /* skip */ }
            }
          }
        } catch (err) {
          console.warn('DbClient query failed:', err)
        }

        // ── Popup overlay ──
        const popupElement = document.createElement('div')
        popupElement.className = 'hidden'
        popupRef.current = popupElement

        const popupOverlay = new Overlay({
          element: popupElement,
          autoPan: { animation: { duration: 250 } },
          positioning: 'bottom-center',
          offset: [0, -10],
        })

        const hidePopup = () => {
          popupOverlay.setPosition(undefined)
          popupElement.className = 'hidden'
          popupElement.replaceChildren()
          setSelectedFeature(null)
          // ponytail: selectInteractionRef.current is unknown (was any); cast minimally
          const si = selectInteractionRef.current as { getFeatures?: () => { clear?: () => void } } | null
          const features = si?.getFeatures?.()
          features?.clear?.()
        }

        // ── Create the map ──
        map = new Map({
          target: mapRef.current,
          layers: [basemaps.osm, basemaps.satellite, basemaps.dark, basemaps.terrain, clusterLayer, drawLayer, measureLayer],
          view: new View({
            center: proj.fromLonLat([37.91, 0.02]),
            zoom: 6,
            minZoom: 6,
            maxZoom: 20,
            extent: [-2.2e7, -1.2e7, 2.2e7, 1.5e7],
          }),
          controls: [
            new ScaleLine({ units: 'metric' }),
            new Attribution({ collapsible: true }),
            new MousePosition({
              coordinateFormat: (coord?: import('ol/coordinate').Coordinate) => {
                if (!coord || coord[0] == null || coord[1] == null || isNaN(coord[0]) || isNaN(coord[1])) return ''
                try {
                  const utmEpsg = params.currentUtmEpsg || 'EPSG:21037'
                  // T1.5b FIX (2026-07-10): Transform to BOTH geographic (EPSG:4326) and
                  // the active UTM zone. Previously, lon/lat were stored as raw EPSG:3857
                  // Web Mercator meters — labeled "Lon/Lat" but actually eastings/northings
                  // in meters. That's a statutory-accuracy bug: a surveyor reading
                  // "Lon: 4105720" would be misled into thinking the data is corrupt or
                  // would copy a Mercator meter value into a statutory form.
                  const [lon, lat] = proj.transform(coord, 'EPSG:3857', 'EPSG:4326')
                  const [e, n] = proj.transform(coord, 'EPSG:3857', utmEpsg)
                  const eSafe = (e != null && !isNaN(e)) ? e : 0
                  const nSafe = (n != null && !isNaN(n)) ? n : 0
                  const lonSafe = (lon != null && !isNaN(lon)) ? lon : 0
                  const latSafe = (lat != null && !isNaN(lat)) ? lat : 0
                  const now = Date.now()
                  if (now - mouseCoordThrottleRef.current > 100) {
                    mouseCoordThrottleRef.current = now
                    setMouseCoord({ lon: lonSafe, lat: latSafe, e: eSafe, n: nSafe })
                  }
                  return `Lon: ${lonSafe.toFixed(6)}  Lat: ${latSafe.toFixed(6)}  E: ${eSafe.toFixed(1)}  N: ${nSafe.toFixed(1)}`
                } catch {
                  const now = Date.now()
                  if (now - mouseCoordThrottleRef.current > 100) {
                    mouseCoordThrottleRef.current = now
                    setMouseCoord({ lon: 0, lat: 0, e: 0, n: 0 })
                  }
                  return ''
                }
              },
              projection: 'EPSG:3857',
              className: 'ol-mouse-position',
            }),
          ],
          overlays: [popupOverlay],
        })

        mapInstance.current = map
        const mapNonNull = map

        // Restore saved map view state
        try {
          const savedView = localStorage.getItem('metardu-map-view')
          if (savedView) {
            const parsed = JSON.parse(savedView) as { center?: [number, number]; zoom?: number }
            const { center, zoom } = parsed
            if (center && zoom) {
              map.getView().setCenter(center)
              map.getView().setZoom(zoom)
            }
          }
        } catch { /* ignore */ }

        // Restore saved drawn features
        try {
          const savedFeatures = localStorage.getItem('metardu-map-features')
          if (savedFeatures) {
            const { default: GeoJSONFmt } = await import('ol/format/GeoJSON')
            const fmt = new GeoJSONFmt()
            const parsed = JSON.parse(savedFeatures) as object
            const features = fmt.readFeatures(parsed, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            })
            drawSource.addFeatures(features)
            setFeatureCount(drawSource.getFeatures().length)
          }
        } catch { /* ignore */ }

        // ── Select interaction ──
        const select = new Select({
          style: new Style({
            fill: new Fill({ color: 'rgba(209, 123, 71,0.3)' }),
            stroke: new Stroke({ color: '#D17B47', width: 3 }),
            image: new CircleStyle({ radius: 10, fill: new Fill({ color: '#D17B47' }), stroke: new Stroke({ color: '#fff', width: 3 }) }),
          }),
          hitTolerance: 5,
          layers: [drawLayer],
        })
        selectInteractionRef.current = select
        map.addInteraction(select)

        select.on('select', (evt: SelectEvent) => {
          const selected = evt.selected
          if (selected.length > 0) {
            const feature = selected[0]
            const coord = feature.getGeometry()?.getClosestPoint(evt.mapBrowserEvent.coordinate)
            const geometry = feature.getGeometry()
            const geomType = geometry?.getType?.() || 'unknown'
            const props = feature.getProperties()

            const clusterFeatures = feature.get('features') as InstanceType<typeof Feature>[] | undefined
            if (clusterFeatures && clusterFeatures.length > 1) {
              const extent = feature.getGeometry()?.getExtent()
              if (extent) mapNonNull.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 500, maxZoom: 15 })
              return
            }

            const projectName = (props.projectName as string | undefined) || (clusterFeatures?.[0]?.get?.('projectName') as string | undefined) || ''
            const stationName = (props.stationName as string | undefined) || (props.label as string | undefined) || (props.name as string | undefined) || ''
            const projectId = (props.projectId as string | undefined) || (clusterFeatures?.[0]?.get?.('projectId') as string | undefined) || ''

            setSelectedFeature(feature)
            setFeatureName(stationName || projectName || geomType)

            onPopupRender(popupElement, {
              coordinate: coord,
              projectName: projectName || undefined,
              stationName: stationName || undefined,
              geometryType: geomType,
              projectId: projectId || undefined,
            }, hidePopup)

            if (coord) popupOverlay.setPosition(coord)
          } else {
            popupElement.className = 'hidden'
            popupElement.replaceChildren()
            popupOverlay.setPosition(undefined)
            setSelectedFeature(null)
          }
        })

        // ── Snap interaction — snaps to drawn features AND scheme parcels/beacons ──
        // Scheme layers are added later by MapClient; we use a dynamic approach:
        // The Snap interaction can be reconfigured when scheme layers load.
        // For now, snap to the draw source. MapClient will add scheme sources via
        // the snap interaction's setSource() or by creating additional Snap interactions.
        const snap = new Snap({ source: drawSource })
        map.addInteraction(snap)

        // Store snap reference on the map for later source addition
        ;(map as OLMapType & { _snapInteraction?: InstanceType<typeof Snap> })._snapInteraction = snap

        // ── DragRotate interaction (Alt + drag to rotate map) ──
        const dragRotate = new DragRotate({
          condition: (mapBrowserEvent) => {
            // Alt key (or Option on Mac) must be held
            const altKey = mapBrowserEvent.originalEvent?.altKey
            return !!altKey
          },
        })
        map.addInteraction(dragRotate)

        // ── PinchRotate interaction (two-finger rotation on mobile) ──
        const pinchRotate = new PinchRotate()
        map.addInteraction(pinchRotate)

        // ── Geolocation ──
        const geolocation = new Geolocation({
          trackingOptions: { enableHighAccuracy: true },
          projection: 'EPSG:3857',
        })

        // ── Drag & Drop ──
        const dragAndDrop = new DragAndDrop({
          formatConstructors: [GeoJSONFormat, KMLFormat, WKTFormat] as unknown as import('ol/format/Feature').default[],
        })
        dragAndDrop.on('addfeatures', (evt: DragAndDropEvent) => {
          const features = evt.features
          if (features && features.length > 0) {
            drawSource.addFeatures(features as InstanceType<typeof Feature>[])
            setFeatureCount(drawSource.getFeatures().length)
            const extent = drawSource.getExtent()
            if (extent && extent[0] !== Infinity) {
              mapNonNull.getView().fit(extent, { padding: [80, 80, 80, 80], maxZoom: 18, duration: 500 })
            }
            setImportMsg(`Imported ${features.length} feature(s)`)
            setTimeout(() => setImportMsg(''), 3000)
            pushHistory()
          }
        })
        map.addInteraction(dragAndDrop)

        // ── Track feature count ──
        drawSource.on('addfeature', () => {
          setFeatureCount(drawSource.getFeatures().length)
        })
        drawSource.on('removefeature', () => {
          setFeatureCount(drawSource.getFeatures().length)
        })

        // ── Zoom to data ──
        if (projectSource.getFeatures().length > 0) {
          try {
            const extent = projectSource.getExtent()
            if (extent && extent[0] !== Infinity) {
              map.getView().fit(extent, { padding: [80, 80, 80, 80], maxZoom: 18 })
            }
          } catch { /* keep default */ }
        }

        // Auto-load specific project from URL param
        const projectIdParam = searchParams.get('projectId')
        if (projectIdParam) {
          const projectFeature = projectSource.getFeatures().find((f) => f.get('projectId') === projectIdParam)
          if (projectFeature) {
            const extent = projectFeature.getGeometry()?.getExtent()
            if (extent && extent[0] !== Infinity) {
              map.getView().fit(extent, { padding: [200, 200, 200, 200], maxZoom: 17, duration: 800 })
            }
          }
        }

        // Store cleanup refs in dedicated ref (not on map object)
        cleanupRef.current = { geolocation, snap, dragAndDrop } as unknown as MapCleanupRefs

        if (!cancelled) setMapReady(true)
      } catch (err: unknown) {
        console.error('Map initialization failed:', err)
        if (!cancelled) setInitError(err instanceof Error ? (err as Error).message : 'Map failed to load')
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (map) {
        try {
          if (cleanupRef.current?.geolocation) {
            cleanupRef.current.geolocation.setTracking(false)
          }
        } catch { /* ignore */ }
        try { map.setTarget(undefined) } catch { /* ignore */ }
        mapInstance.current = null
        cleanupRef.current = null
      }
    }
  
  }, [])
}
