export function generateNonce(): string {
  // Try Next.js built-in Web Crypto first
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(array).toString('base64')
    }
    return typeof btoa !== 'undefined' ? btoa(String.fromCharCode(...Array.from(array))) : 'fallback-nonce-1'
  }

  // Try Node.js crypto in Edge/Node environments
  try {
    const nodeCrypto = require('crypto')
    return nodeCrypto.randomBytes(16).toString('base64')
  } catch (e) {
    // Fallback if neither works
  }

  const array = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(array).toString('base64')
  }
  return typeof btoa !== 'undefined' ? btoa(String.fromCharCode(...Array.from(array))) : 'fallback-nonce-2'
}

console.log(generateNonce())
