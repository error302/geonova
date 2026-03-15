export type WebhookEvent = 
  | 'survey.created'
  | 'survey.updated'
  | 'survey.deleted'
  | 'point.created'
  | 'point.updated'
  | 'project.created'
  | 'project.updated'
  | 'project.completed'
  | 'user.signed_up'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'payment.completed'
  | 'payment.failed'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
  userId?: string
  projectId?: string
}

export interface WebhookSubscription {
  id: string
  url: string
  events: WebhookEvent[]
  secret: string
  active: boolean
  createdAt: string
  lastTriggeredAt?: string
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: WebhookEvent
  payload: WebhookPayload
  status: 'pending' | 'success' | 'failed'
  responseCode?: number
  responseBody?: string
  attempts: number
  createdAt: string
  deliveredAt?: string
}

export const WEBHOOK_SIGNATURE_HEADER = 'x-geonova-signature'
export const WEBHOOK_SECRET_PREFIX = 'whsec_'
