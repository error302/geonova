import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getPayPalService } from '@/lib/payments/paypal'
import { getPlanPrice, PlanId, CurrencyCode } from '@/lib/subscription/catalog'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CreateOrderSchema = z.object({
  planId: z.enum(['pro', 'team', 'firm', 'enterprise']),
  currency: z.enum(['KES', 'USD', 'EUR', 'GBP']),
})

/**
 * POST /api/payments/paypal/create
 *
 * SECURITY (audit H-02, 2026-08-30): this route previously minted PayPal
 * orders for UNAUTHENTICATED callers under the merchant's credentials, and
 * never recorded anything server-side — so the capture path had no row to
 * credit against and PayPal customers paid for nothing. Now:
 *   1. Requires an authenticated session.
 *   2. Resolves the price server-side from the catalog (client amounts are
 *      never trusted).
 *   3. Creates a pending payment_intents row bound to (user, plan, amount)
 *      so the capture step can verify and credit against it.
 */
export const POST = apiHandler(
  { auth: true, rateLimit: { max: 20, windowMs: 60000 }, schema: CreateOrderSchema },
  async (_req, ctx) => {
    const { planId, currency } = ctx.body as z.infer<typeof CreateOrderSchema>

    const price = getPlanPrice(planId as PlanId, currency as CurrencyCode)
    if (!price || price <= 0) {
      return NextResponse.json({ error: 'Invalid plan or free plan selected' }, { status: 400 })
    }

    const paypal = getPayPalService()
    if (!paypal) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 })
    }

    const order = await paypal.createOrder({
      amount: price,
      currency,
      description: `METARDU ${(planId as string).toUpperCase()} Plan`,
    })

    // Persist the intent so capture can verify ownership, amount and status.
    await db.query<never>(
      `INSERT INTO payment_intents
         (user_id, amount, currency, payment_method, status, provider_id, plan_id, metadata)
       VALUES ($1, $2, $3, 'paypal', 'pending', $4, $5, $6)`,
      [
        ctx.userId,
        price,
        currency,
        order.id,
        planId,
        JSON.stringify({ orderId: order.id, source: 'paypal_direct' }),
      ]
    )

    logger.info('[paypal] Order created', { userId: ctx.userId, planId, orderId: order.id })

    return NextResponse.json({ orderId: order.id })
  }
)
