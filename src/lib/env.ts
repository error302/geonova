import { z } from 'zod'

const envSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),

  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORT_CODE: z.string().optional(),
  MPESA_INITIATOR_NAME: z.string().optional(),
  MPESA_SECURITY_CREDENTIAL: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),

  AIRTEL_CLIENT_ID: z.string().optional(),
  AIRTEL_CLIENT_SECRET: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal('')),

  NEXT_PUBLIC_LOG_ENDPOINT: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('production'),

  PYTHON_COMPUTE_URL: z.string().url().optional().or(z.literal('')),

  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  GOOGLE_SITE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d*$/).optional(),
  ADMIN_EMAILS: z.string().optional(),

  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.warn('Some environment variables are missing - runtime features may be limited')
}

const defaults = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
} as const

export const env = { ...defaults, ...parsedEnv.data }

export function requireEnv(name: keyof typeof env): string {
  const value = env[name]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${String(name)}`)
  }

  return value
}
