import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

// This handler automatically sets up the message listeners
// to communicate with the CreateWebWorkerMLCEngine in the main thread.
const handler = new WebWorkerMLCEngineHandler()

// Listen to messages from the main thread
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
