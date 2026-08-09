'use client'
/**
 * Stakeout Mode — GPS-guided point navigation for field surveying
 *
 * Provides:
 *  - Overlay creation (target marker, direction arrow, distance/bearing labels)
 *  - Audio alerts (proximity beeps using Web Audio API)
 *  - Bearing/distance computation in Arc 1960 / UTM Zone 37S
 *  - Color-coded proximity indicators
 *
 * All OpenLayers imports are dynamic for SSR compatibility.
 * Uses EPSG:21037 for coordinate math.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface StakeoutTarget {
  easting: number
  northing: number
  elevation?: number
  name?: string
  id?: string
}

export interface StakeoutPosition {
  easting: number
  northing: number
  elevation?: number
  accuracy: number
}

export interface StakeoutState {
  distance: number
  bearing: number
  bearingWCB: string
  dE: number
  dN: number
  elevationDiff: number | null
  proximityColor: 'green' | 'amber' | 'red'
  proximityLabel: string
}

// ─── Bearing / Distance Computation ──────────────────────────────────────

/**
 * Compute the whole-circle bearing from one point to another.
 * Returns bearing in degrees (0-360, clockwise from north).
 */
export function computeStakeoutBearing(
  from: { easting: number; northing: number },
  to: { easting: number; northing: number }
): number {
  const dE = to.easting - from.easting
  const dN = to.northing - from.northing
  let bearing = (Math.atan2(dE, dN) * 180) / Math.PI
  if (bearing < 0) bearing += 360
  return bearing
}

/**
 * Compute the horizontal distance between two points in meters.
 */
export function computeStakeoutDistance(
  from: { easting: number; northing: number },
  to: { easting: number; northing: number }
): number {
  const dE = to.easting - from.easting
  const dN = to.northing - from.northing
  return Math.sqrt(dE * dE + dN * dN)
}

/**
 * Format a bearing in WCB (Whole Circle Bearing) format: D°MM'SS"
 */
export function formatBearingWCB(bearing: number): string {
  const degrees = Math.floor(bearing)
  const minutesFloat = (bearing - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = Math.round((minutesFloat - minutes) * 60)
  return `${degrees}\u00B0${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"`
}

/**
 * Compute the full stakeout state (distance, bearing, proximity, elevation).
 */
export function computeStakeoutState(
  current: StakeoutPosition,
  target: StakeoutTarget
): StakeoutState {
  const distance = computeStakeoutDistance(current, target)
  const bearing = computeStakeoutBearing(current, target)
  const bearingWCB = formatBearingWCB(bearing)
  const dE = target.easting - current.easting
  const dN = target.northing - current.northing

  const elevationDiff =
    current.elevation != null && target.elevation != null
      ? target.elevation - current.elevation
      : null

  let proximityColor: 'green' | 'amber' | 'red'
  let proximityLabel: string
  if (distance < 1) {
    proximityColor = 'green'
    proximityLabel = 'ARRIVED'
  } else if (distance < 3) {
    proximityColor = 'amber'
    proximityLabel = 'CLOSE'
  } else {
    proximityColor = 'red'
    proximityLabel = 'APPROACHING'
  }

  return { distance, bearing, bearingWCB, dE, dN, elevationDiff, proximityColor, proximityLabel }
}

// ─── Audio Alerts ─────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null
let beepInterval: ReturnType<typeof setInterval> | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available — fail silently
  }
}

function playBeep() {
  playTone(880, 0.15, 'sine')
}

function playFastBeep() {
  playTone(1200, 0.08, 'sine')
}

function playContinuousTone() {
  playTone(1400, 0.3, 'square')
}

function playArrivedChime() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    // Three-note ascending chime
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.3)
    })
  } catch {
    // Audio not available
  }
}

let lastArrivedChime = 0

/**
 * Create a proximity-based audio alert system.
 * Call on each GPS position update with the current distance.
 * Returns a cleanup function to stop the alerts.
 */
export function createStakeoutAudioAlert(distance: number): void {
  // Stop existing interval
  if (beepInterval) {
    clearInterval(beepInterval)
    beepInterval = null
  }

  if (distance < 1) {
    // Arrived — play chime once (no more than once every 5 seconds)
    const now = Date.now()
    if (now - lastArrivedChime > 5000) {
      playArrivedChime()
      lastArrivedChime = now
    }
  } else if (distance < 3) {
    // Very close — continuous tone every 500ms
    playContinuousTone()
    beepInterval = setInterval(() => playContinuousTone(), 500)
  } else if (distance < 10) {
    // Close — fast beep every 400ms
    playFastBeep()
    beepInterval = setInterval(() => playFastBeep(), 400)
  } else {
    // Far — slow beep every 1500ms
    playBeep()
    beepInterval = setInterval(() => playBeep(), 1500)
  }
}

/**
 * Stop the stakeout audio alerts.
 */
export function stopStakeoutAudio(): void {
  if (beepInterval) {
    clearInterval(beepInterval)
    beepInterval = null
  }
  lastArrivedChime = 0
}

// ─── Overlay Creation ─────────────────────────────────────────────────────

/**
 * Create an OL overlay showing the stakeout target on the map.
 * Returns the overlay and a Vector source for the direction line.
 * All OL imports are dynamic for SSR safety.
 */
export async function createStakeoutOverlay(
  target: StakeoutTarget,
  epsg: string = 'EPSG:21037',
): Promise<{
  overlay: import('ol/Overlay').default
  targetSource: import('ol/source/Vector').default
  targetLayer: import('ol/layer/Vector').default
  directionSource: import('ol/source/Vector').default
  directionLayer: import('ol/layer/Vector').default
}> {
  const [
    { default: Overlay },
    { default: VectorSource },
    { default: VectorLayer },
    { default: Feature },
    { default: Point },
    { default: Style },
    { default: Fill },
    { default: Stroke },
    { default: CircleStyle },
    { transform },
  ] = await Promise.all([
    import('ol/Overlay'),
    import('ol/source/Vector'),
    import('ol/layer/Vector'),
    import('ol/Feature'),
    import('ol/geom/Point'),
    import('ol/style/Style'),
    import('ol/style/Fill'),
    import('ol/style/Stroke'),
    import('ol/style/Circle'),
    import('ol/proj').then(m => ({ transform: m.transform })),
  ])

  // Transform target from UTM to EPSG:3857
  const targetCoord = transform([target.easting, target.northing], epsg, 'EPSG:3857')

  // ── Target marker overlay (DOM element) ──
  const overlayEl = document.createElement('div')
  overlayEl.className = 'stakeout-target-overlay'
  overlayEl.style.cssText = 'position:relative;pointer-events:none;'

  // Crosshair container
  const crosshair = document.createElement('div')
  crosshair.style.cssText = `
    width: 48px; height: 48px; position: relative;
    transform: translate(-50%, -50%);
  `

  // Horizontal line
  const hLine = document.createElement('div')
  hLine.style.cssText = `
    position:absolute; top:50%; left:0; width:100%; height:2px;
    background: #D17B47; transform: translateY(-50%);
    box-shadow: 0 0 6px rgba(209, 123, 71,0.6);
  `
  // Vertical line
  const vLine = document.createElement('div')
  vLine.style.cssText = `
    position:absolute; left:50%; top:0; height:100%; width:2px;
    background: #D17B47; transform: translateX(-50%);
    box-shadow: 0 0 6px rgba(209, 123, 71,0.6);
  `
  // Center dot
  const center = document.createElement('div')
  center.style.cssText = `
    position:absolute; top:50%; left:50%; width:8px; height:8px;
    background: #D17B47; border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 12px rgba(209, 123, 71,0.8);
    animation: stakeout-pulse 1.5s ease-in-out infinite;
  `
  // Outer ring
  const ring = document.createElement('div')
  ring.style.cssText = `
    position:absolute; top:50%; left:50%; width:32px; height:32px;
    border: 2px solid rgba(209, 123, 71,0.5); border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: stakeout-ring 2s ease-in-out infinite;
  `
  // Label
  const label = document.createElement('div')
  label.style.cssText = `
    position:absolute; top:100%; left:50%; transform:translateX(-50%);
    margin-top:8px; white-space:nowrap;
    font-size:11px; font-family:monospace; color:#D17B47;
    background:rgba(20,20,30,0.9); padding:2px 6px; border-radius:4px;
    border:1px solid rgba(209, 123, 71,0.3);
  `
  label.textContent = target.name || `E:${target.easting.toFixed(1)} N:${target.northing.toFixed(1)}`

  crosshair.append(hLine, vLine, ring, center, label)
  overlayEl.appendChild(crosshair)

  // Add CSS animations if not already present
  if (!document.getElementById('stakeout-animations')) {
    const style = document.createElement('style')
    style.id = 'stakeout-animations'
    style.textContent = `
      @keyframes stakeout-pulse {
        0%, 100% { box-shadow: 0 0 12px rgba(209, 123, 71,0.8); }
        50% { box-shadow: 0 0 24px rgba(209, 123, 71,1); }
      }
      @keyframes stakeout-ring {
        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.2; }
      }
    `
    document.head.appendChild(style)
  }

  const overlay = new Overlay({
    element: overlayEl,
    position: targetCoord,
    positioning: 'center-center' as any,
    stopEvent: false,
  })

  // ── Target point feature (beacon marker) ──
  const targetSource = new VectorSource()
  const targetFeature = new Feature({
    geometry: new Point(targetCoord),
    stakeoutTarget: true,
  })
  targetFeature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: 10,
        fill: new Fill({ color: 'rgba(209, 123, 71,0.3)' }),
        stroke: new Stroke({ color: '#D17B47', width: 2.5 }),
      }),
    })
  )
  targetSource.addFeature(targetFeature)

  const targetLayer = new VectorLayer({
    source: targetSource,
    zIndex: 100,
  })

  // ── Direction line source (updated on each GPS position) ──
  const directionSource = new VectorSource()
  const directionLayer = new VectorLayer({
    source: directionSource,
    style: new Style({
      stroke: new Stroke({
        color: 'rgba(209, 123, 71,0.6)',
        width: 2,
        lineDash: [8, 6],
      }),
    }),
    zIndex: 99,
  })

  return { overlay, targetSource, targetLayer, directionSource, directionLayer }
}

/**
 * Update the stakeout direction line from current GPS position to target.
 * Call on each GPS position update.
 */
export async function updateStakeoutDirection(
  directionSource: import('ol/source/Vector').default,
  current: StakeoutPosition,
  target: StakeoutTarget,
  epsg: string = 'EPSG:21037',
): Promise<StakeoutState> {
  const { default: Feature } = await import('ol/Feature')
  const { default: LineString } = await import('ol/geom/LineString')
  const { transform } = await import('ol/proj')

  const state = computeStakeoutState(current, target)

  const fromCoord = transform([current.easting, current.northing], epsg, 'EPSG:3857')
  const toCoord = transform([target.easting, target.northing], epsg, 'EPSG:3857')

  // Clear previous direction features
  directionSource.clear()

  const lineFeature = new Feature({
    geometry: new LineString([fromCoord, toCoord]),
  })

  // Color-code based on proximity
  let lineColor: string
  if (state.proximityColor === 'green') lineColor = 'rgba(34,197,94,0.8)'
  else if (state.proximityColor === 'amber') lineColor = 'rgba(245,158,11,0.8)'
  else lineColor = 'rgba(209, 123, 71,0.6)'

  const { default: Style } = await import('ol/style/Style')
  const { default: Stroke } = await import('ol/style/Stroke')
  lineFeature.setStyle(
    new Style({
      stroke: new Stroke({
        color: lineColor,
        width: 2.5,
        lineDash: [8, 6],
      }),
    })
  )

  directionSource.addFeature(lineFeature)
  return state
}

/**
 * Update the target marker style based on proximity.
 */
export async function updateTargetProximityStyle(
  targetSource: import('ol/source/Vector').default,
  proximityColor: 'green' | 'amber' | 'red'
): Promise<void> {
  const { default: Style } = await import('ol/style/Style')
  const { default: Fill } = await import('ol/style/Fill')
  const { default: Stroke } = await import('ol/style/Stroke')
  const { default: CircleStyle } = await import('ol/style/Circle')

  const colorMap = {
    green: { fill: 'rgba(34,197,94,0.3)', stroke: '#22c55e' },
    amber: { fill: 'rgba(245,158,11,0.3)', stroke: '#f59e0b' },
    red: { fill: 'rgba(209, 123, 71,0.3)', stroke: '#D17B47' },
  }
  const colors = colorMap[proximityColor]

  const features = targetSource.getFeatures()
  for (const f of features) {
    f.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: colors.fill }),
          stroke: new Stroke({ color: colors.stroke, width: 2.5 }),
        }),
      })
    )
  }
}
