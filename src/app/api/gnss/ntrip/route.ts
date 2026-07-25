/**
 * GET /api/gnss/ntrip?host=X&port=Y&mountpoint=Z&user=W&pass=P
 *
 * Server-Sent Events endpoint that connects to an NTRIP caster via TCP
 * and streams RTCM3 correction messages to the browser.
 *
 * AUDIT FIX (2026-07-03): Browsers can't do raw TCP (NTRIP protocol),
 * so this server-side proxy bridges the gap. It connects to the NTRIP
 * caster using Node's `net` module, parses RTCM3 messages, and forwards
 * them as SSE events.
 *
 * The browser receives:
 *   - `status` events: connection status, message count, errors
 *   - `rtcm` events: parsed RTCM3 message type + timestamp
 *
 * For actual correction data forwarding to a GNSS receiver, the browser
 * would use the Web Serial API or Web Bluetooth API to send the raw
 * RTCM bytes to the receiver over a serial/Bluetooth connection.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 minutes max per connection

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseRTCM3Message, type NTRIPConfig } from '@/lib/gnss/ntripClient'

// AUDIT FIX (2026-07-05): SSRF protection. Previously this endpoint accepted
// any host:port — an attacker could make the server connect to internal
// services (e.g. http://169.254.169.254/ for cloud metadata, or
// http://localhost:5432/ to probe the DB). Now restricted to:
//   - Public IPs only (no RFC1918, no loopback, no link-local)
//   - Standard NTRIP port (2101) or ports 80/443/8080/8443
//   - Hostnames that resolve to public IPs
// Also requires auth (was previously anonymous).
const ALLOWED_PORTS = new Set([2101, 80, 443, 8080, 8443])

function isPrivateIP(ip: string): boolean {
  // Loopback
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) return true
  // Link-local
  if (ip.startsWith('169.254.')) return true
  // Private ranges (RFC1918)
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  // 172.16.0.0/12
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  // CGNAT 100.64.0.0/10
  if (ip.startsWith('100.')) {
    const second = parseInt(ip.split('.')[1], 10)
    if (second >= 64 && second <= 127) return true
  }
  // Multicast / reserved
  if (ip.startsWith('224.') || ip.startsWith('240.')) return true
  return false
}

async function resolveAndCheckHost(hostname: string): Promise<string | null> {
  try {
    const { lookup } = await import('dns')
    return new Promise((resolve) => {
      lookup(hostname, { family: 4 }, (err, address) => {
        if (err || !address || isPrivateIP(address)) {
          resolve(null)
        } else {
          resolve(address)
        }
      })
    })
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // ── Auth: require login (was previously anonymous) ──────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { searchParams } = new URL(request.url)
  const host = searchParams.get('host')
  const port = parseInt(searchParams.get('port') || '2101', 10)
  const mountpoint = searchParams.get('mountpoint') || ''
  const username = searchParams.get('user') || undefined
  const password = searchParams.get('pass') || undefined

  if (!host || !mountpoint) {
    return new Response(JSON.stringify({ error: 'host and mountpoint are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Port allow-list ─────────────────────────────────────────────────────
  if (!ALLOWED_PORTS.has(port)) {
    return new Response(
      JSON.stringify({ error: `Port ${port} not allowed. Use 2101 (NTRIP standard) or 80/443/8080/8443.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── SSRF check: reject private/loopback/link-local IPs ─────────────────
  // Also reject raw IP literals that are private.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIP(host)) {
    return new Response(
      JSON.stringify({ error: 'Connecting to private/internal IPs is not allowed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // For hostnames, resolve and check the IP
  const resolvedIP = await resolveAndCheckHost(host)
  if (!resolvedIP) {
    return new Response(
      JSON.stringify({ error: 'Could not resolve host or host resolves to a private/internal IP' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const config: NTRIPConfig = { host, port, mountpoint, username, password }

  // Use Server-Sent Events
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      send('status', { connected: false, message: `Connecting to ${host}:${port}/${mountpoint}...` })

      try {
        // Dynamic import net (Node.js only)
        const { createConnection } = await import('net')

        const socket = createConnection({ host, port }, () => {
          // Send NTRIP HTTP request
          const auth = username
            ? `Authorization: Basic ${Buffer.from(`${username}:${password || ''}`).toString('base64')}\r\n`
            : ''

          const req =
            `GET /${mountpoint} HTTP/1.1\r\n` +
            `Host: ${host}:${port}\r\n` +
            auth +
            `User-Agent: METARDU/1.0\r\n` +
            `Ntrip-Version: Ntrip/2.0\r\n` +
            `Accept: rtk/rtcm, ./\r\n` +
            `\r\n`

          socket.write(req)
        })

        let buffer = Buffer.alloc(0)
        let headerParsed = false
        let messageCount = 0
        let lastMessageAt: string | null = null

        socket.on('data', (data: Buffer) => {
          buffer = Buffer.concat([buffer, data])

          // First, check for HTTP response header
          if (!headerParsed) {
            const headerEnd = buffer.indexOf('\r\n\r\n')
            if (headerEnd === -1) return

            const header = buffer.slice(0, headerEnd).toString('ascii')
            buffer = buffer.slice(headerEnd + 4)
            headerParsed = true

            if (header.includes('200 OK') || header.includes('200 ok') || header.includes('ICY 200 OK')) {
              send('status', { connected: true, message: 'Connected to NTRIP caster' })
            } else {
              const errLine = header.split('\r\n')[0] || 'Unknown error'
              send('status', { connected: false, error: `NTRIP caster rejected: ${errLine}` })
              socket.destroy()
              controller.close()
              return
            }
          }

          // Parse RTCM3 messages from the buffer
          let offset = 0
          while (offset < buffer.length) {
            // Look for RTCM3 preamble (0xD3)
            if (buffer[offset] !== 0xD3) {
              offset++
              continue
            }

            const msg = parseRTCM3Message(buffer, offset)
            if (!msg) break

            messageCount++
            lastMessageAt = new Date().toISOString()

            // Send parsed message info (not the raw bytes — too large for SSE)
            send('rtcm', {
              type: msg.type,
              length: msg.length,
              receivedAt: msg.receivedAt,
              messageCount,
              lastMessageAt,
            })

            offset += 3 + msg.length + 3  // preamble + length + body + CRC
          }

          // Trim processed data from buffer
          if (offset > 0) {
            buffer = buffer.slice(offset)
          }

          // Prevent buffer from growing unboundedly
          if (buffer.length > 65536) {
            buffer = buffer.slice(-4096)  // keep last 4KB
          }
        })

        socket.on('error', (err: Error) => {
          send('status', { connected: false, error: `Connection error: ${err.message}` })
          controller.close()
        })

        socket.on('close', () => {
          send('status', { connected: false, message: 'Connection closed' })
          controller.close()
        })

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          socket.destroy()
          controller.close()
        })

      } catch (err) {
        send('status', {
          connected: false,
          error: `Failed to create connection: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
