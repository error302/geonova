/**
 * M-Pesa Till and Payment Configuration
 * Centralizes the M-Pesa Buy Goods Till Number with environment variable support.
 */

export const DEFAULT_MPESA_TILL = '3370347'

export function getMpesaTillNumber(): string {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.NEXT_PUBLIC_MPESA_TILL_NUMBER ||
      process.env.MPESA_TILL_NUMBER ||
      DEFAULT_MPESA_TILL
    )
  }
  return DEFAULT_MPESA_TILL
}
