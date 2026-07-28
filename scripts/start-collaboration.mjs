#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// METARDU — Collaboration WebSocket Server Entrypoint
// ──────────────────────────────────────────────────────────────────────────
// Replaces the fragile `node -e` command in docker-compose.yml.
// Proper error handling, graceful shutdown, and health check support.
// ──────────────────────────────────────────────────────────────────────────

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  try {
    const { getCollaborationServer } = await import('../src/lib/realtime/collaborationServer.js');
    const server = getCollaborationServer();
    server.start(PORT);
    console.log(`[collaboration] WebSocket server running on port ${PORT}`);
  } catch (err) {
    console.error('[collaboration] Failed to start:', err);
    process.exit(1);
  }
}

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[collaboration] ${signal} received, shutting down...`);
    process.exit(0);
  });
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[collaboration] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[collaboration] Unhandled rejection:', err);
  process.exit(1);
});

main();
