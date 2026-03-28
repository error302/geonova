export type PaymentPurpose =
  | 'SUBSCRIPTION_MONTHLY'
  | 'SUBSCRIPTION_ANNUAL'
  | 'JOB_COMMISSION'
  | 'ENTERPRISE_LICENSE'
  | 'CPD_CERTIFICATE'
  | 'PARCEL_SEARCH'

export type PaymentMethod = 'MPESA' | 'STRIPE_CARD' | 'PAYPAL'

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETE'
  | 'FAILED'
  | 'REFUNDED'

export interface PaymentIntent {
  id: string
  userId: string
  organizationId?: string
  amount: number
  currency: string
  amountKES: number
  purpose: PaymentPurpose
  referenceId?: string
  method: PaymentMethod
  status: PaymentStatus
  providerRef?: string
  metadata: Record<string, unknown>
  createdAt: string
  completedAt?: string
}

export interface MpesaSTKPushRequest {
  phoneNumber: string
  amount: number
  accountRef: string
  description: string
}
