/**
 * @module collabEntry
 *
 * Standalone entry point for the collaboration WebSocket server.
 *
 * This file is what the `metardu-collaboration` Docker container runs:
 *     CMD ["node", "collabEntry.js"]
 *
 * It is NOT imported by the Next.js app — the app imports
 * `collaborationServer.ts` (the library) and `useCollaboration.ts` (the
 * client hook). Keeping the bootstrap in its own file means the library
 * stays free of side-effects and we don't need `require.main === module`
 * gymnastics that confuse the Next.js bundler.
 */
/* eslint-disable no-console */

import { getCollaborationServer } from './collaborationServer'

const port = Number(process.env.PORT || 3001)
const server = getCollaborationServer()

server.start(port)

// Graceful shutdown so Docker can recycle the container cleanly.
process.on('SIGTERM', () => {
  server.stop()
  process.exit(0)
})
process.on('SIGINT', () => {
  server.stop()
  process.exit(0)
})

console.log(`[collaboration] WebSocket server listening on :${port}/ws/collaboration`)
