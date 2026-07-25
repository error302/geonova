import type { CapacitorConfig } from '@capacitor/cli'

/**
 * METARDU Access — Capacitor Configuration
 *
 * METARDU Access is the mobile field data collection app — the surveyor's
 * gateway to the field. Named to parallel industry-standard field apps:
 *   - Trimble Access
 *   - Leica Captivate
 *   - METARDU Access
 *
 * Features:
 *   - Total station connection via Web Serial / USB OTG
 *   - GNSS rover connection via Bluetooth LE
 *   - Offline field book with auto-save
 *   - Real-time QC (closure, precision, cross-checks)
 *   - Push notifications for QC failures
 *   - Voice input for remarks
 *   - Haptic feedback for eyes-free operation
 */

const config: CapacitorConfig = {
  appId: 'com.metardu.access',
  appName: 'METARDU Access',
  webDir: 'out',  // Next.js static export output directory
  backgroundColor: '#0a0e14',  // dark theme background
  server: {
    androidScheme: 'https',
    // For development, point to the dev server:
    // url: 'http://192.168.1.100:3000',
    // cleartext: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0a0e14',
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    Geolocation: {
      // Request foreground location permissions
      permissions: ['location'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0e14',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#f59e0b',
      splashFullScreen: true,
      splashImmersive: true,
    },
    CapacitorHttp: {
      enabled: true,  // allow HTTP requests from the native app
    },
  },
}

export default config
