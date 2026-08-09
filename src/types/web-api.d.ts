// Structural typings for non-standard / vendor-prefixed browser APIs.
// Follows the web-bluetooth.d.ts pattern — global ambient declarations merged
// into the DOM lib so call sites avoid `(window as any)` / `as any` casts.

// ─── Web Speech API (SpeechRecognition / webkitSpeechRecognition) ───────────

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence?: number
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike {
  readonly results: SpeechRecognitionResultListLike
  readonly resultIndex: number
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string
  readonly message?: string
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

// ─── Capacitor native bridge (window.Capacitor) ─────────────────────────────

interface CapacitorNetworkStatusLike {
  connected: boolean
}

interface CapacitorNetworkPluginLike {
  addListener(
    eventName: string,
    listener: (status: CapacitorNetworkStatusLike) => void
  ): Promise<{ remove: () => void }>
}

interface CapacitorGlobalLike {
  Plugins?: {
    Network?: CapacitorNetworkPluginLike
  }
}

// ─── Window / Navigator / DeviceOrientationEvent augmentations ──────────────

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
  webkitAudioContext?: typeof AudioContext
  Capacitor?: CapacitorGlobalLike
  proj4?: typeof import('proj4')
}

interface Navigator {
  /** iOS Safari — true when the PWA runs standalone from the home screen */
  standalone?: boolean
}

interface DeviceOrientationEvent {
  /** iOS Safari — compass heading in degrees (0-360) */
  webkitCompassHeading?: number
}
