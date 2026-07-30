/**
 * useFieldSessionState — React hook that subscribes to FieldSession state
 *
 * Uses useSyncExternalStore for React 18+ concurrent-safe subscription.
 */

import { useSyncExternalStore } from 'react'
import { getFieldSession, type FieldSessionState, type SurveyType } from '@/lib/field/fieldSession'

export function useFieldSessionState(projectId: string, surveyType: SurveyType = 'cadastral'): FieldSessionState {
  const session = getFieldSession(projectId, surveyType)
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
}

/**
 * Get the session instance itself (for calling methods like setupStation, captureMeasurement).
 */
export function useFieldSession(projectId: string, surveyType: SurveyType = 'cadastral') {
  return getFieldSession(projectId, surveyType)
}
