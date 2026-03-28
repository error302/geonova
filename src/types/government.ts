export type GovernmentFeature =
  | 'BULK_PARCEL_EXPORT'
  | 'AUDIT_LOGS'
  | 'API_ACCESS'
  | 'PRIORITY_SUPPORT'
  | 'CUSTOM_REPORTS'
  | 'DATA_EXPORT'
  | 'SSO'

export interface GovernmentLicense {
  id: string
  organizationId: string
  ministry: string
  department?: string
  county?: string
  licenseNumber: string
  seatCount: number
  features: GovernmentFeature[]
  auditRequired: boolean
  dataResidency: 'KENYA' | 'EAC' | 'ANY'
  procurementRef?: string
  startDate: string
  endDate: string
  contactPerson?: string
  contactEmail?: string
}

export interface AuditLogEntry {
  id: string
  organizationId: string
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  metadata: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}
