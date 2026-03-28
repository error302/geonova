import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAnalytics, Analytics, logEvent as firebaseLogEvent, setUserId } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB8BLn1RcKotFNi6rzELqi0UfZKBCiuaPE',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'project-27dc5.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'project-27dc5',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'project-27dc5.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1023923407768',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1023923407768:web:107bdda1a0bec5510879ed',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-2Y3ZWJ06TW',
}

let app: FirebaseApp | null = null
let analytics: Analytics | null = null

export function initFirebase(): Analytics | null {
  if (typeof window === 'undefined') return null
  
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig)
    } else {
      app = getApps()[0]
    }
    
    analytics = getAnalytics(app)
    return analytics
  } catch (error) {
    console.error('Firebase init error:', error)
    return null
  }
}

export function logEvent(eventName: string, params?: Record<string, unknown>) {
  if (!analytics) {
    analytics = initFirebase()
  }
  
  if (analytics) {
    firebaseLogEvent(analytics, eventName, params)
  }
}

export function setUserProperty(name: string, value: string) {
  // User properties can only be set after user ID is available
}

export function setAnalyticsUserId(userId: string) {
  if (analytics) {
    setUserId(analytics, userId)
  }
}

// Custom events for METARDU
export const analyticsEvents = {
  // Page views
  pageView: (pageName: string) => logEvent('page_view', { page: pageName }),
  
  // Auth events
  signUp: (method: string) => logEvent('sign_up', { method }),
  login: (method: string) => logEvent('login', { method }),
  
  // Survey tools
  toolUsed: (toolName: string) => logEvent('tool_used', { tool_name: toolName }),
  calculationPerformed: (toolName: string, calculationType: string) => 
    logEvent('calculation_performed', { tool_name: toolName, calculation_type: calculationType }),
  
  // Projects
  projectCreated: (projectType: string) => logEvent('project_created', { project_type: projectType }),
  projectOpened: (projectId: string) => logEvent('project_opened', { project_id: projectId }),
  
  // Export
  exportStarted: (format: string) => logEvent('export_started', { format }),
  exportCompleted: (format: string) => logEvent('export_completed', { format }),
  
  // AI features
  aiFeatureUsed: (featureName: string) => logEvent('ai_feature_used', { feature_name: featureName }),
  
  // Errors
  error: (errorType: string, errorMessage: string) => 
    logEvent('error', { error_type: errorType, error_message: errorMessage }),
}

export default analytics
