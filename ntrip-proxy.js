/**
 * METARDU NTRIP WebSocket Proxy Server
 * ======================================
 * Bridges WebSocket connections from the browser to NTRIP casters
 * over raw TCP. This is required because browsers cannot open raw
 * TCP sockets to NTRIP casters — they need a WebSocket intermediary.
 *
 * Architecture:
 *   Browser ←→ WebSocket ←→ This Proxy ←→ TCP ←→ NTRIP Caster
 *
 * Usage:
 *   node ntrip-proxy.js                     # Start on default port 8090
 *   PORT=9090 node ntrip-proxy.js           # Custom port
 *
 * Environment:
 *   PORT — WebSocket server port (default: 8090)
 *   ALLOWED_HOSTS — Comma-separated NTRIP caster hosts (default: deny all — audit H-11)
 *
 * Docker:
 *   Wired into docker-compose.yml as the metardu-ntrip service (P0-6, 2026-07-24).
 *   Build via Dockerfile.ntrip. Expose port 8090. Configure ALLOWED_HOSTS
 *   via the NTRIP_ALLOWED_HOSTS env var (comma-separated).
 *
 * Protocol:
 *   1. Browser opens WebSocket to ws://proxy-host:8090/ntrip
 *   2. Client sends JSON: { host, port, mountpoint, username, password, version }
 *   3. Proxy opens TCP connection to the NTRIP caster
 *   4. Proxy sends NTRIP HTTP-style request over TCP
 *   5. Proxy forwards RTCM data from caster → client (binary WebSocket frames)
 *   6. Proxy forwards GGA sentences from client → caster (text WebSocket frames)
 *
 * Security:
 *   - CORS restricted to Metardu domains
 *   - Optional host allowlist
 *   - Connection timeout (30s idle)
 *   - Max connections per IP (10)
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');
const dns = require('dns');

const PORT = parseInt(process.env.PORT || '8090', 10);
// SECURITY (audit H-11, 2026-08-30): the host allowlist now DEFAULT-DENIES.
// Previously an empty ALLOWED_HOSTS meant "allow all hosts", turning this
// proxy into an unauthenticated open TCP relay with SSRF into the Docker
// network (metardu-postgres:5432, metardu-redis:6379). With no allowlist
// configured the proxy now refuses every target.
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
// Optional shared secret required on every connection when set.
const PROXY_SECRET = process.env.NTRIP_PROXY_SECRET || '';
const MAX_CONNECTIONS_PER_IP = 10;
const IDLE_TIMEOUT_MS = 300000; // 5 minutes
const CONNECT_TIMEOUT_MS = 15000; // 15 seconds

function isPrivateIP(ip) {
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) return true;
  if (ip.startsWith('169.254.') || ip.startsWith('fe80:') || ip.startsWith('::1')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('100.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 64 && second <= 127) return true;
  }
  if (ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.')) return true;
  if (ip.startsWith('224.') || ip.startsWith('240.')) return true;
  return false;
}

// Reject anything containing CR/LF/NUL — prevents request-line header
// injection through mountpoint, credentials or host (audit H-11).
function isCleanString(value) {
  return typeof value === 'string'
    && value.length > 0
    && !/[\r\n\x00-\x1f]/.test(value);
}

// Resolve a hostname once and return the validated public IP literal.
// Connecting to the LITERAL kills the DNS-rebinding TOCTOU where validation
// and connection resolve the name separately.
function resolvePublicHost(hostname) {
  return new Promise((resolve, reject) => {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      if (isPrivateIP(hostname)) return reject(new Error('private IP not allowed'));
      return resolve(hostname);
    }
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) return reject(err);
      if (isPrivateIP(address)) return reject(new Error('host resolves to a private/internal address'));
      resolve(address);
    });
  });
}

// Track connections per IP
const connectionsPerIP = new Map();

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'ntrip-proxy',
      connections: wss ? wss.clients.size : 0,
      allowedHosts: ALLOWED_HOSTS.length > 0 ? ALLOWED_HOSTS : ['*'],
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const wss = new WebSocketServer({ server, path: '/ntrip' });

wss.on('connection', (ws, req) => {
  const clientIP = req.headers['x-forwarded-for']?.split(',').map(h => h.trim()).filter(Boolean).pop()
    || req.socket.remoteAddress;

  // SECURITY (audit H-11, 2026-08-30): optional shared secret. When
  // NTRIP_PROXY_SECRET is set, connections must present ?token=<secret>.
  if (PROXY_SECRET) {
    const url = new URL(req.url || '/ntrip', 'http://localhost');
    const token = url.searchParams.get('token');
    if (token !== PROXY_SECRET) {
      ws.close(4001, 'Unauthorized');
      return;
    }
  }

  // Rate limit per IP
  const currentConns = connectionsPerIP.get(clientIP) || 0;
  if (currentConns >= MAX_CONNECTIONS_PER_IP) {
    console.warn(`[ntrip-proxy] Max connections reached for ${clientIP}, rejecting`);
    ws.close(429, 'Too many connections');
    return;
  }
  connectionsPerIP.set(clientIP, currentConns + 1);

  let tcpSocket = null;
  let idleTimer = null;
  let connectTimer = null;
  let config = null;

  console.log(`[ntrip-proxy] New WebSocket connection from ${clientIP}`);

  function cleanup() {
    if (idleTimer) clearTimeout(idleTimer);
    if (connectTimer) clearTimeout(connectTimer);
    if (tcpSocket) {
      try { tcpSocket.destroy(); } catch {}
      tcpSocket = null;
    }
    const conns = connectionsPerIP.get(clientIP) || 0;
    connectionsPerIP.set(clientIP, Math.max(0, conns - 1));
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      console.log(`[ntrip-proxy] Idle timeout for ${clientIP}`);
      ws.close(1000, 'Idle timeout');
      cleanup();
    }, IDLE_TIMEOUT_MS);
  }

  // Handle incoming messages from the browser
  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      // Text message — could be JSON config or GGA sentence
      const text = data.toString();

      // Try to parse as JSON config
      try {
        const json = JSON.parse(text);
        if (json.host && json.mountpoint) {
          config = json;
          connectToCaster(config);
          return;
        }
      } catch {
        // Not JSON — treat as GGA sentence to forward to caster
      }

      // Forward GGA sentences to the NTRIP caster
      if (tcpSocket && tcpSocket.writable) {
        tcpSocket.write(text + '\r\n');
        resetIdleTimer();
      }
    } else {
      // Binary message — forward to NTRIP caster (unusual but handle it)
      if (tcpSocket && tcpSocket.writable) {
        tcpSocket.write(data);
        resetIdleTimer();
      }
    }
  });

  ws.on('close', () => {
    console.log(`[ntrip-proxy] WebSocket closed for ${clientIP}`);
    cleanup();
  });

  ws.on('error', (err) => {
    console.error(`[ntrip-proxy] WebSocket error for ${clientIP}:`, err.message);
    cleanup();
  });

  // Connect to NTRIP caster via TCP
  function connectToCaster(cfg) {
    const { host, port = 2101, mountpoint, username, password, version = 2 } = cfg;

    // SECURITY (audit H-11): validate every client-supplied string BEFORE it
    // reaches the TCP request line — CRLF/NUL bytes are rejected outright.
    if (!isCleanString(host) || !isCleanString(mountpoint)) {
      ws.close(4002, 'Invalid host or mountpoint');
      cleanup();
      return;
    }
    if (username !== undefined && username !== null && !isCleanString(String(username))) {
      ws.close(4002, 'Invalid username');
      cleanup();
      return;
    }
    if (password !== undefined && password !== null && !isCleanString(String(password))) {
      ws.close(4002, 'Invalid password');
      cleanup();
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      ws.close(4002, 'Invalid port');
      cleanup();
      return;
    }

    // Default-deny allowlist (audit H-11): with no ALLOWED_HOSTS configured,
    // every target is refused.
    if (ALLOWED_HOSTS.length === 0) {
      ws.close(403, 'No NTRIP hosts allowed — set ALLOWED_HOSTS (NTRIP_ALLOWED_HOSTS in compose)');
      cleanup();
      return;
    }
    if (!ALLOWED_HOSTS.includes(String(host).toLowerCase())) {
      ws.close(403, `Host ${host} not allowed`);
      cleanup();
      return;
    }

    console.log(`[ntrip-proxy] Connecting to ${host}:${port}/${mountpoint}`);

    // SSRF guard: resolve once, validate, and connect to the IP literal so
    // DNS rebinding cannot swap the address between check and connect.
    resolvePublicHost(host).then((ipLiteral) => {
      tcpSocket = new net.Socket();
      tcpSocket.setTimeout(0); // No Node.js-level timeout; we manage our own

      // Connect timeout
      connectTimer = setTimeout(() => {
        console.error(`[ntrip-proxy] Connect timeout to ${host}:${port}`);
        ws.close(504, 'Connection timeout');
        cleanup();
      }, CONNECT_TIMEOUT_MS);

      tcpSocket.connect(port, ipLiteral, () => {
        clearTimeout(connectTimer);
        console.log(`[ntrip-proxy] TCP connected to ${host}:${port}`);

        // Build NTRIP request
        const auth = username && password
          ? `Authorization: Basic ${Buffer.from(`${username}:${password}`).toString('base64')}\r\n`
          : '';

        const ntripVersion = version === 2 ? 'Ntrip-Version: Ntrip/2.0\r\n' : '';

        const request =
          `GET /${mountpoint} HTTP/1.1\r\n` +
          `Host: ${host}:${port}\r\n` +
          `User-Agent: NTRIP MetarduProxy/1.0\r\n` +
          auth +
          ntripVersion +
          `Connection: close\r\n` +
          `\r\n`;

        tcpSocket.write(request);
        resetIdleTimer();
      });

      // Forward data from NTRIP caster to browser
      tcpSocket.on('data', (chunk) => {
        if (ws.readyState === 1) { // OPEN
          ws.send(chunk, { binary: true });
          resetIdleTimer();
        }
      });

      tcpSocket.on('error', (err) => {
        console.error(`[ntrip-proxy] TCP error for ${host}:${port}:`, err.message);
        if (ws.readyState === 1) {
          ws.close(502, 'NTRIP connection error');
        }
        cleanup();
      });

      tcpSocket.on('close', () => {
        console.log(`[ntrip-proxy] TCP connection closed to ${host}:${port}`);
        if (ws.readyState === 1) {
          ws.close(1000, 'NTRIP connection closed');
        }
        cleanup();
      });
    }).catch((err) => {
      console.error(`[ntrip-proxy] Refusing ${host}:${port}:`, err.message);
      ws.close(403, 'Host not allowed (SSRF protection)');
      cleanup();
    });
  }

  // If the client doesn't send config within 10 seconds, close
  connectTimer = setTimeout(() => {
    if (!config) {
      ws.close(1008, 'No NTRIP config received');
      cleanup();
    }
  }, 10000);
});

server.listen(PORT, () => {
  console.log(`[ntrip-proxy] WebSocket proxy listening on port ${PORT}`);
  console.log(`[ntrip-proxy] Allowed hosts: ${ALLOWED_HOSTS.length > 0 ? ALLOWED_HOSTS.join(', ') : 'NONE (default-deny — set ALLOWED_HOSTS to enable)'}`);
  console.log(`[ntrip-proxy] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ntrip-proxy] SIGTERM received, shutting down...');
  wss.clients.forEach((ws) => ws.close(1001, 'Server shutting down'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
});
