export type CPDActivity =
  | 'PEER_REVIEW_COMPLETED'
  | 'PEER_REVIEW_RECEIVED'
  | 'JOB_COMPLETED'
  | 'SURVEY_REPORT_GENERATED'
  | 'DEED_PLAN_SIGNED'
  | 'EQUIPMENT_CALIBRATED'
  | 'TRAINING_COMPLETED'
  | 'CONFERENCE_ATTENDED'
  | 'PAPER_PUBLISHED'
  | 'MANUAL_ENTRY'

export interface CPDRecord {
  id: string
  userId: string
  activity: CPDActivity
  points: number
  earnedAt: string
  referenceId?: string
  description: string
  verifiable: boolean
  supportingDoc?: string
  /** Approval state (audit H9 follow-up, 2026-08-31): manual entries are
   *  created pending admin approval; until approved they do NOT count
   *  toward the annual total. Exposed so the UI can say so instead of
   *  rendering every record as "Verified". */
  approved?: boolean
  /** Rejection reason, present when an admin rejected a pending entry. */
  rejectionReason?: string
}

export interface CPDCertificate {
  id: string
  userId: string
  surveyorName: string
  iskNumber: string
  year: number
  totalPoints: number
  activities: CPDRecord[]
  generatedAt: string
  verificationCode: string
  pdfPath?: string
}

export const CPD_POINTS: Record<CPDActivity, number> = {
  PEER_REVIEW_COMPLETED: 2,
  PEER_REVIEW_RECEIVED: 1,
  JOB_COMPLETED: 3,
  SURVEY_REPORT_GENERATED: 1,
  DEED_PLAN_SIGNED: 1,
  EQUIPMENT_CALIBRATED: 1,
  TRAINING_COMPLETED: 0, // Variable - manual entry
  CONFERENCE_ATTENDED: 0, // Variable - manual entry
  PAPER_PUBLISHED: 5,
  MANUAL_ENTRY: 0 // Variable - manual entry
}
