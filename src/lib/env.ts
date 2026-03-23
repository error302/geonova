import { z } from 'zod'

// Define the schema for environment variables
const envSchema = z.object({
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required for payments'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),

  // PayPal
  PAYPAL_CLIENT_ID: z.string().min(1, 'PAYPAL_CLIENT_ID is required'),
  PAYPAL_CLIENT_SECRET: z.string().min(1, 'PAYPAL_CLIENT_SECRET is required'),

  // M-Pesa (Kenya)
  MPESA_CONSUMER_KEY: z.string().min(1, 'MPESA_CONSUMER_KEY is required'),
  MPESA_CONSUMER_SECRET: z.string().min(1, 'MPESA_CONSUMER_SECRET is required'),
  MPESA_SHORT_CODE: z.string().min(1, 'MPESA_SHORT_CODE is required'),
  MPESA_INITIATOR_NAME: z.string().min(1, 'MPESA_INITIATOR_NAME is required'),
  MPESA_SECURITY_CREDENTIAL: z.string().min(1, 'MPESA_SECURITY_CREDENTIAL is required'),
  MPESA_PASSKEY: z.string().min(1, 'MPESA_PASSKEY is required'),

  // Airtel Money
  AIRTEL_CLIENT_ID: z.string().min(1, 'AIRTEL_CLIENT_ID is required'),
  AIRTEL_CLIENT_SECRET: z.string().min(1, 'AIRTEL_CLIENT_SECRET is required'),

  // App URLs
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  
  // Monitoring / Sentry
  NEXT_PUBLIC_LOG_ENDPOINT: z.string().url('NEXT_PUBLIC_LOG_ENDPOINT must be a valid URL').optional().or(z.literal('')),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url('NEXT_PUBLIC_SENTRY_DSN must be a valid URL'),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('production'),

  // Python Engine
  PYTHON_COMPUTE_URL: z.string().url('PYTHON_COMPUTE_URL must be a valid URL'),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_FROM_EMAIL: z.string().min(1, 'RESEND_FROM_EMAIL is required'),

  // SEO
  GOOGLE_SITE_VERIFICATION: z.string().min(1, 'GOOGLE_SITE_VERIFICATION is required'),

  // Community
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d+$/, 'WhatsApp number must contain only digits'),

  // Admins
  ADMIN_EMAILS: z.string().min(1, 'ADMIN_EMAILS is required (comma separated)')
})

// Parse environment variables and fail loudly if any are missing or invalid
const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2))
  throw new Error('Invalid environment variables. Ensure all required variables are set in .env.local')
}

// Export the strictly typed env variables
export const env = parsedEnv.data
