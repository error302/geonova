import type { AttachmentSlot } from '@/types/submission'

// Pre-defined attachment slots for boundary/subdivision submissions
// Extendable for other survey types

export const BOUNDARY_ATTACHMENT_SLOTS: AttachmentSlot[] = [
  {
    id: 'ppa2',
    label: 'Physical Planning Approval (PPA2)',
    required: true,
    accepts: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMB: 10,
    helpText: 'Approval from local authority for subdivision / change of user',
  },
  {
    id: 'lcb_consent',
    label: 'Land Control Board Consent',
    required: true,
    accepts: ['application/pdf'],
    maxSizeMB: 10,
    helpText: 'Required for subdivisions under the Land Control Act Cap 302',
  },
  {
    id: 'mutation_form',
    label: 'Mutation Form / Subdivision Scheme',
    required: true,
    accepts: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMB: 20,
    helpText: 'Form LRA 67 or equivalent, signed by landowner and registered surveyor',
  },
  {
    id: 'rtk_raw',
    label: 'RTK Raw GNSS Output',
    required: false,
    accepts: [
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/xml'
    ],
    maxSizeMB: 50,
    helpText: 'Raw GNSS field data from RTK session (CSV, TXT, RINEX, etc.)',
  },
  {
    id: 'field_book_export',
    label: 'Digital Field Book Export',
    required: false,
    accepts: [
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/xml'
    ],
    maxSizeMB: 20,
    helpText: 'Exported from total station / GNSS instrument (.FBK, CSV, LandXML)',
  },
]

export function getRequiredAttachmentsStatus(
  attachments: Record<string, string>,
  slots: AttachmentSlot[] = BOUNDARY_ATTACHMENT_SLOTS
): { missing: string[]; ready: string[] } {
  const missing: string[] = []
  const ready: string[] = []

  for (const slot of slots) {
    if (attachments[slot.id]) {
      ready.push(slot.label)
    } else if (slot.required) {
      missing.push(slot.label)
    }
  }

  return { missing, ready }
}

