/**
 * @module collaborationServer
 *
 * Real-time collaboration server using WebSocket.
 *
 * Features:
 * - Live presence (who's online in a project)
 * - Cursor sharing (see other users' mouse position on the map)
 * - Live feature editing (see when others draw/edit features)
 * - Conflict resolution via last-write-wins (LWW) with timestamp comparison.
 *   AUDIT FIX (M17, 2026-07-02): Previous docstring claimed "operational
 *   transforms" — that was inaccurate. The actual implementation is LWW:
 *   incoming edits with an older timestamp than the server's copy are
 *   rejected with a `conflict_rejected` message. Three-way merge is
 *   available in the offline sync queue (src/lib/offline/syncQueue.ts)
 *   but is NOT used by the realtime collaboration server.
 *
 * This module sets up a WebSocket server that can be integrated
 * with Next.js custom server or run as a separate process.
 *
 * For Docker deployment, this runs alongside the Next.js app
 * on a separate port (3001) or as a serverless WebSocket.
 */
/* eslint-disable no-console */

import { WebSocketServer, WebSocket } from 'ws'
import { createServer, IncomingMessage } from 'http'
import { parse } from 'url'
import { createHmac, timingSafeEqual } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Collaborator {
  id: string
  userId: string
  userName: string
  projectId: string
  cursor?: { lat: number; lng: number }
  color: string
  lastSeen: number
  ws: WebSocket
}

interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor' | 'feature_edit' | 'feature_delete' | 'chat' | 'presence'
  userId?: string
  userName?: string
  projectId?: string
  cursor?: { lat: number; lng: number }
  feature?: {
    id: string
    type: 'Point' | 'LineString' | 'Polygon'
    geometry: unknown
    properties?: Record<string, unknown>
  }
  featureId?: string
  message?: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Room Ticket Authentication (audit H-09, 2026-08-30)
// ---------------------------------------------------------------------------

/**
 * Signed room ticket — proves BOTH identity and project membership.
 *
 * The collaboration WebSocket server has no database access, so project
 * membership cannot be checked at connection time directly. Instead, the
 * authenticated HTTP route POST /api/realtime/ticket verifies ownership
 * (checkProjectAccess) and issues this short-lived HMAC ticket binding
 * (userId, projectId). The WS server only needs the shared AUTH_SECRET to
 * validate it — constant-time, expiry-checked, room-scoped.
 *
 * This replaces the previous scheme where the NextAuth session JWT traveled
 * as a URL query parameter (leaking into proxy/access logs) and any
 * authenticated user could join ANY project room by bare projectId. When
 * AUTH_SECRET was unset the server even accepted a self-declared `?userId=`
 * — full impersonation. Both paths are gone.
 */
const ROOM_TICKET_TTL_MS = 5 * 60 * 1000

export function signRoomTicket(
  secret: string,
  userId: string,
  projectId: string,
  userName?: string
): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, projectId, userName, exp: Date.now() + ROOM_TICKET_TTL_MS }),
    'utf8'
  ).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyRoomTicket(
  secret: string,
  ticket: string,
  projectId: string
): { userId: string; userName?: string } | null {
  try {
    const dot = ticket.indexOf('.')
    if (dot <= 0 || dot === ticket.length - 1) return null
    const payload = ticket.slice(0, dot)
    const sig = ticket.slice(dot + 1)

    // Constant-time signature comparison
    const expected = createHmac('sha256', secret).update(payload).digest()
    let given: Buffer
    try {
      given = Buffer.from(sig, 'base64url')
    } catch {
      return null
    }
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return null
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId?: unknown
      projectId?: unknown
      userName?: unknown
      exp?: unknown
    }

    // Binding + expiry checks — all fail closed
    if (typeof data.userId !== 'string' || data.userId.length === 0) return null
    if (data.projectId !== projectId) return null
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null

    return {
      userId: data.userId,
      userName: typeof data.userName === 'string' && data.userName.length > 0 ? data.userName : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Authenticate a WebSocket connection request via its room ticket.
 * Returns the verified user + the room they are authorized to join, or null.
 *
 * SECURITY (audit H-09, 2026-08-30): there is NO unauthenticated fallback
 * any more. Previously, when AUTH_SECRET was unset, the server accepted a
 * self-declared ?userId= (full impersonation); the JWT path never checked
 * token expiry and used non-constant-time comparison.
 */
function authenticateRequest(req: IncomingMessage): { userId: string; userName: string; projectId: string } | null {
  const url = parse(req.url || '', true)
  const ticket = url.query.ticket as string | undefined
  const projectId = url.query.projectId as string | undefined

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    console.error('[CollaborationServer] AUTH_SECRET not set — refusing all connections (fail closed)')
    return null
  }

  if (!ticket || !projectId) return null

  const verified = verifyRoomTicket(secret, ticket, projectId)
  if (!verified) return null

  return {
    userId: verified.userId,
    userName: verified.userName || `User ${verified.userId.substring(0, 6)}`,
    projectId,
  }
}

// ---------------------------------------------------------------------------
// Conflict Resolution (Last-Write-Wins with timestamps)
// ---------------------------------------------------------------------------

interface FeatureVersion {
  featureId: string
  version: number
  timestamp: number
  userId: string
  data: unknown
}

class ConflictResolver {
  private versions: Map<string, FeatureVersion> = new Map()

  /**
   * Attempt to apply an update. Returns true if accepted, false if rejected
   * (stale version).
   */
  applyUpdate(featureId: string, data: unknown, timestamp: number, userId: string): boolean {
    const existing = this.versions.get(featureId)

    if (existing && timestamp < existing.timestamp) {
      // Stale update — reject
      return false
    }

    this.versions.set(featureId, {
      featureId,
      version: (existing?.version || 0) + 1,
      timestamp,
      data,
      userId,
    })

    return true
  }

  delete(featureId: string): void {
    this.versions.delete(featureId)
  }

  getVersion(featureId: string): FeatureVersion | undefined {
    return this.versions.get(featureId)
  }
}

// ---------------------------------------------------------------------------
// Collaboration Server
// ---------------------------------------------------------------------------

export class CollaborationServer {
  private wss: WebSocketServer | null = null
  private collaborators: Map<string, Collaborator> = new Map()
  private projectRooms: Map<string, Set<string>> = new Map() // projectId -> set of collaborator IDs
  private conflictResolvers: Map<string, ConflictResolver> = new Map() // projectId -> resolver

  // User colors for cursor display
  private readonly COLORS = [
    '#D17B47', '#3B82F6', '#10B981', '#8B5CF6',
    '#F59E0B', '#EF4444', '#06B6D4', '#EC4899',
  ]

  start(port: number = 3001) {
    const server = createServer((req, res) => {
      // Tiny HTTP listener for health checks. The collaboration server's
      // real traffic is WebSocket on /ws/collaboration; this endpoint only
      // exists so orchestrators (docker-compose healthcheck, k8s liveness)
      // can confirm the process is alive.
      if ((req.url || '').split('?')[0] === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          collaborators: this.collaborators.size,
          projects: this.projectRooms.size,
          uptime: process.uptime(),
        }))
        return
      }
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not Found')
    })
    this.wss = new WebSocketServer({ server, path: '/ws/collaboration' })

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Authenticate the connection — ticket binds userId AND the room
      const auth = authenticateRequest(req)
      if (!auth) {
        ws.close(1008, 'Authentication failed')
        return
      }

      // SECURITY (audit H-09, 2026-08-30): the room is the one the ticket
      // authorizes — never a client-supplied projectId.
      const projectId = auth.projectId
      if (!projectId) {
        ws.close(1008, 'Missing projectId')
        return
      }

      const { userId, userName } = auth
      const collaboratorId = `${userId}-${Date.now()}`
      const color = this.COLORS[this.collaborators.size % this.COLORS.length]

      const collaborator: Collaborator = {
        id: collaboratorId,
        userId,
        userName: userName || `User ${userId.substring(0, 6)}`,
        projectId,
        color,
        lastSeen: Date.now(),
        ws,
      }

      this.collaborators.set(collaboratorId, collaborator)

      // Add to project room
      let room = this.projectRooms.get(projectId)
      if (!room) {
        room = new Set()
        this.projectRooms.set(projectId, room)
      }
      room.add(collaboratorId)

      // Notify room of new collaborator
      this.broadcastToProject(projectId, {
        type: 'join',
        userId,
        userName: collaborator.userName,
        projectId,
        timestamp: Date.now(),
      }, collaboratorId)

      // Send current presence to new collaborator
      this.sendPresence(ws, projectId)

      ws.on('message', (data: Buffer) => {
        try {
                    const msg: CollaborationMessage = JSON.parse(data.toString()) as unknown as CollaborationMessage
          collaborator.lastSeen = Date.now()

          switch (msg.type) {
            case 'cursor':
              collaborator.cursor = msg.cursor
              this.broadcastToProject(projectId, {
                type: 'cursor',
                userId,
                userName: collaborator.userName,
                cursor: msg.cursor,
                timestamp: Date.now(),
              }, collaboratorId)
              break

            case 'feature_edit': {
              // Conflict resolution: last-write-wins with timestamps
              const resolver = this.getResolver(projectId)
              const featureId = msg.feature?.id
              if (!featureId) break

              const accepted = resolver.applyUpdate(
                featureId,
                msg.feature,
                msg.timestamp,
                userId,
              )

              if (accepted) {
                this.broadcastToProject(projectId, {
                  type: 'feature_edit',
                  userId,
                  userName: collaborator.userName,
                  feature: msg.feature,
                  timestamp: msg.timestamp,
                }, collaboratorId)
              } else {
                // Reject stale update — notify sender
                ws.send(JSON.stringify({
                  type: 'conflict_rejected',
                  featureId,
                  message: 'Update rejected — newer version exists',
                  timestamp: Date.now(),
                }))
              }
              break
            }

            case 'feature_delete': {
              const resolver = this.getResolver(projectId)
              if (msg.featureId) {
                resolver.delete(msg.featureId)
              }
              this.broadcastToProject(projectId, {
                type: 'feature_delete',
                userId,
                userName: collaborator.userName,
                featureId: msg.featureId,
                timestamp: Date.now(),
              }, collaboratorId)
              break
            }

            case 'chat':
              this.broadcastToProject(projectId, {
                type: 'chat',
                userId,
                userName: collaborator.userName,
                message: msg.message,
                timestamp: Date.now(),
              }, collaboratorId)
              break
          }
        } catch (err) {
          console.error('[CollaborationServer] Message parse error:', err)
        }
      })

      ws.on('close', () => {
        this.collaborators.delete(collaboratorId)
        this.projectRooms.get(projectId)?.delete(collaboratorId)

        this.broadcastToProject(projectId, {
          type: 'leave',
          userId,
          userName: collaborator.userName,
          timestamp: Date.now(),
        })
      })

      ws.on('error', (err) => {
        console.error('[CollaborationServer] WebSocket error:', err)
      })
    })

    // Heartbeat — remove stale connections
    setInterval(() => {
      const now = Date.now()
      for (const [id, collab] of this.collaborators) {
        if (now - collab.lastSeen > 60000) { // 60s timeout
          collab.ws.terminate()
          this.collaborators.delete(id)
          this.projectRooms.get(collab.projectId)?.delete(id)
        }
      }
    }, 30000)

    server.listen(port, () => {
    })
  }

  private broadcastToProject(projectId: string, msg: CollaborationMessage, excludeId?: string) {
    const room = this.projectRooms.get(projectId)
    if (!room) return

    const data = JSON.stringify(msg)
    for (const collabId of room) {
      if (collabId === excludeId) continue
      const collab = this.collaborators.get(collabId)
      if (collab && collab.ws.readyState === WebSocket.OPEN) {
        collab.ws.send(data)
      }
    }
  }

  private getResolver(projectId: string): ConflictResolver {
    let resolver = this.conflictResolvers.get(projectId)
    if (!resolver) {
      resolver = new ConflictResolver()
      this.conflictResolvers.set(projectId, resolver)
    }
    return resolver
  }

  private sendPresence(ws: WebSocket, projectId: string) {
    const room = this.projectRooms.get(projectId)
    if (!room) return

    const presence = Array.from(room)
      .map(id => this.collaborators.get(id))
      .filter((c): c is Collaborator => c !== undefined)
      .map(c => ({
        userId: c.userId,
        userName: c.userName,
        color: c.color,
        cursor: c.cursor,
      }))

    ws.send(JSON.stringify({
      type: 'presence',
      timestamp: Date.now(),
      payload: presence,
    }))
  }

  stop() {
    this.wss?.close()
    this.collaborators.clear()
    this.projectRooms.clear()
    this.conflictResolvers.clear()
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let serverInstance: CollaborationServer | null = null

export function getCollaborationServer(): CollaborationServer {
  if (!serverInstance) {
    serverInstance = new CollaborationServer()
  }
  return serverInstance
}
