/**
 * Deed plan export output types — shared between the server renderer and the
 * client export dialog. Dependency-free so it can be imported from 'use client'
 * components without pulling the Node-only SurveyPlanRenderer into the bundle.
 */

export type DeedPlanOutputType = 'internal' | 'cadastral' | 'deed' | 'client'

export interface DeedPlanOutputTypeDef {
  id: DeedPlanOutputType
  label: string
  /** plan_title stamped in the panel header. */
  title: string
  description: string
}

export const DEED_PLAN_OUTPUT_TYPES: DeedPlanOutputTypeDef[] = [
  {
    id: 'internal',
    label: 'Internal Survey Report',
    title: 'SURVEY REPORT — INTERNAL',
    description: 'Working document with full coordinate, bearing and beacon schedules.',
  },
  {
    id: 'cadastral',
    label: 'Cadastral Plan Draft',
    title: 'CADASTRAL PLAN DRAFT',
    description: 'Formal cadastral plan for submission review before finalisation.',
  },
  {
    id: 'deed',
    label: 'Deed Plan Draft',
    title: 'DEED PLAN DRAFT',
    description: 'Standard deed plan draft — never presented as an authenticated plan.',
  },
  {
    id: 'client',
    label: 'Client Presentation Plan',
    title: 'BOUNDARY IDENTIFICATION PLAN',
    description: 'Clean presentation layout for client handover.',
  },
]