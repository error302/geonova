/**
 * @module milestoneEscrow
 *
 * M-Pesa Milestone Escrow System
 *
 * Locks/unlocks project features based on payment milestones.
 * Prevents scope creep — clients pay before deliverables are released.
 *
 * Milestone flow:
 * 1. Project created → FREE (basic access)
 * 2. Milestone 1: Field Commencement → STK Push → unlock field collection
 * 3. Milestone 2: Survey Complete → STK Push → unlock document generation
 * 4. Milestone 3: Final Delivery → STK Push → unlock signed PDF/GeoJSON export
 *
 * Uses existing M-Pesa Daraja API (src/lib/payments/mpesa.ts)
 */

export type MilestoneId = 'field_commencement' | 'survey_complete' | 'final_delivery'
export type MilestoneStatus = 'locked' | 'pending_payment' | 'paid' | 'overdue'

export interface ProjectMilestone {
  id: MilestoneId
  name: string
  description: string
  amountKES: number
  status: MilestoneStatus
  dueDate?: string
  paidAt?: string
  mpesaCheckoutRequestId?: string
  mpesaReceiptNumber?: string
  // Features unlocked by this milestone
  unlocksFeature: string[]
}

export interface EscrowState {
  projectId: string
  milestones: ProjectMilestone[]
  totalContractValue: number
  totalPaid: number
  outstandingBalance: number
  currentMilestone: MilestoneId
  allMilestonesMet: boolean
}

/**
 * Default milestone configuration.
 */
export const DEFAULT_MILESTONES: Omit<ProjectMilestone, 'amountKES' | 'status'>[] = [
  {
    id: 'field_commencement',
    name: 'Field Commencement',
    description: 'Unlock field data collection, GNSS rover connection, and fieldbook',
    dueDate: undefined,
    unlocksFeature: ['fieldbook', 'gnss_rover', 'ntrip', 'mobile_capture'],
  },
  {
    id: 'survey_complete',
    name: 'Survey Complete',
    description: 'Unlock document generation, deed plans, and mutation forms',
    dueDate: undefined,
    unlocksFeature: ['document_generation', 'deed_plan', 'mutation_form', 'nlims_export'],
  },
  {
    id: 'final_delivery',
    name: 'Final Delivery',
    description: 'Unlock cryptographically signed deliverables and submission package',
    dueDate: undefined,
    unlocksFeature: ['signed_export', 'submission_package', 'crypto_seal'],
  },
]

/**
 * Initialize escrow for a new project.
 */
export function initializeEscrow(
  projectId: string,
  contractValueKES: number,
  milestoneSplits?: Array<{ id: MilestoneId; percentage: number }>,
): EscrowState {
  const splits = milestoneSplits || [
    { id: 'field_commencement', percentage: 30 },
    { id: 'survey_complete', percentage: 40 },
    { id: 'final_delivery', percentage: 30 },
  ]

  const milestones: ProjectMilestone[] = DEFAULT_MILESTONES.map(template => {
    const split = splits.find(s => s.id === template.id)
    const amountKES = Math.round(contractValueKES * (split?.percentage || 33) / 100)

    return {
      ...template,
      amountKES,
      status: template.id === 'field_commencement' ? 'pending_payment' : 'locked',
    }
  })

  return {
    projectId,
    milestones,
    totalContractValue: contractValueKES,
    totalPaid: 0,
    outstandingBalance: contractValueKES,
    currentMilestone: 'field_commencement',
    allMilestonesMet: false,
  }
}

/**
 * Check if a feature is unlocked for a project.
 */
export function isFeatureUnlocked(escrow: EscrowState, feature: string): boolean {
  for (const milestone of escrow.milestones) {
    if (milestone.status === 'paid' && milestone.unlocksFeature.includes(feature)) {
      return true
    }
  }
  return false
}

/**
 * Mark a milestone as paid (after M-Pesa callback).
 */
export function markMilestonePaid(
  escrow: EscrowState,
  milestoneId: MilestoneId,
  receiptNumber: string,
): EscrowState {
  const milestones = escrow.milestones.map(m => {
    if (m.id === milestoneId) {
      return {
        ...m,
        status: 'paid' as MilestoneStatus,
        paidAt: new Date().toISOString(),
        mpesaReceiptNumber: receiptNumber,
      }
    }
    return m
  })

  // Unlock next milestone
  const milestoneOrder: MilestoneId[] = ['field_commencement', 'survey_complete', 'final_delivery']
  const currentIdx = milestoneOrder.indexOf(milestoneId)
  const nextMilestone = milestoneOrder[currentIdx + 1]

  if (nextMilestone) {
    const nextIdx = milestones.findIndex(m => m.id === nextMilestone)
    if (nextIdx >= 0 && milestones[nextIdx].status === 'locked') {
      milestones[nextIdx] = { ...milestones[nextIdx], status: 'pending_payment' }
    }
  }

  const totalPaid = milestones
    .filter(m => m.status === 'paid')
    .reduce((sum, m) => sum + m.amountKES, 0)

  const allMilestonesMet = milestones.every(m => m.status === 'paid')
  const currentMilestone = allMilestonesMet
    ? 'final_delivery'
    : milestoneOrder.find(id => milestones.find(m => m.id === id)?.status === 'pending_payment') || 'final_delivery'

  return {
    ...escrow,
    milestones,
    totalPaid,
    outstandingBalance: escrow.totalContractValue - totalPaid,
    currentMilestone,
    allMilestonesMet,
  }
}

/**
 * Get the current pending milestone (or null if all paid).
 */
export function getCurrentPendingMilestone(escrow: EscrowState): ProjectMilestone | null {
  return escrow.milestones.find(m => m.status === 'pending_payment') || null
}

/**
 * Generate an escrow status report.
 */
export function generateEscrowReport(escrow: EscrowState): string {
  let report = 'M-PESA MILESTONE ESCROW REPORT\n'
  report += '═══════════════════════════════\n\n'
  report += `Project: ${escrow.projectId}\n`
  report += `Contract Value: KES ${escrow.totalContractValue.toLocaleString()}\n`
  report += `Total Paid: KES ${escrow.totalPaid.toLocaleString()}\n`
  report += `Outstanding: KES ${escrow.outstandingBalance.toLocaleString()}\n`
  report += `Status: ${escrow.allMilestonesMet ? 'FULLY PAID — all features unlocked' : 'PENDING — some features locked'}\n\n`

  report += 'Milestones:\n'
  for (const m of escrow.milestones) {
    const statusIcon = m.status === 'paid' ? '[PAID]' :
                       m.status === 'pending_payment' ? '[PENDING]' :
                       m.status === 'overdue' ? '[OVERDUE]' : '[LOCKED]'
    report += `  ${statusIcon} ${m.name}: KES ${m.amountKES.toLocaleString()}`
    if (m.paidAt) report += ` — paid ${new Date(m.paidAt).toLocaleDateString()}`
    if (m.mpesaReceiptNumber) report += ` (receipt: ${m.mpesaReceiptNumber})`
    report += '\n'
  }

  return report
}
