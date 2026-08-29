import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { checkProjectAccess } from '@/lib/security/projectAccess'
import { signRoomTicket } from '@/lib/realtime/collaborationServer'

export const dynamic = 'force-dynamic'

const TicketSchema = z.object({
  projectId: z.string().uuid(),
})
/**
 * POST /api/realtime/ticket
 *
 * SECURITY (audit H-09, 2026-08-30): issues a short-lived signed room ticket
 * for the collaboration WebSocket server. The WS server has no database
 * access, so project membership is proven with this HMAC ticket instead of
 * trusting whatever projectId arrives on the wire. The ticket binds
 * (userId, projectId), expires in 5 minutes, and only grants the room it
 * was issued for.
 */
export const POST = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 }, schema: TicketSchema },
  async (_req, ctx) => {
    const { projectId } = ctx.body as z.infer<typeof TicketSchema>

    // Verify the caller owns or is a member of the project
    const access = await checkProjectAccess(ctx.userId, projectId)
    if (!access.allowed) {
      return NextResponse.json(
        { error: 'You do not have access to this project', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: 'Collaboration server is not configured', code: 'WS_NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    const ticket = signRoomTicket(
      secret,
      ctx.userId,
      projectId,
      (ctx.session?.user as { name?: string } | undefined)?.name || undefined
    )

    return NextResponse.json({ ticket, projectId, expiresInMs: 5 * 60 * 1000 })
  }
)
