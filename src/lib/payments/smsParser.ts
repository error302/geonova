/**
 * Safaricom M-Pesa SMS Parser
 * Parses both customer payment confirmation SMS and merchant till receipt SMS
 * to enable zero-Daraja instant payment verification.
 */

export interface ParsedMpesaSms {
  success: boolean
  mpesaCode?: string
  amount?: number
  currency?: string
  senderName?: string
  senderPhone?: string
  recipient?: string
  timestamp?: string
  rawText: string
  error?: string
}

export function parseMpesaSms(smsText: string): ParsedMpesaSms {
  if (!smsText || typeof smsText !== 'string') {
    return { success: false, rawText: smsText || '', error: 'Empty SMS content' }
  }

  const cleanText = smsText.trim()

  // 1. Extract M-Pesa Transaction Code (typically 10 alphanumeric characters at start or after code pattern)
  const codeMatch = cleanText.match(/\b([A-Z0-9]{8,12})\s+Confirmed\b/i) ||
                    cleanText.match(/\bConfirmed\.?\s+([A-Z0-9]{8,12})\b/i) ||
                    cleanText.match(/^([A-Z0-9]{8,12})\b/i)

  const mpesaCode = codeMatch ? codeMatch[1].toUpperCase() : undefined

  // 2. Extract Amount (e.g. "Ksh500.00", "Ksh 500", "KSh5,000.00")
  const amountMatch = cleanText.match(/Ksh\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i)
  let amount: number | undefined = undefined
  if (amountMatch) {
    const rawAmount = amountMatch[1].replace(/,/g, '')
    const parsed = parseFloat(rawAmount)
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed
    }
  }

  // 3. Extract Sender Name & Phone (for merchant receipt SMS)
  const senderMatch = cleanText.match(/from\s+([A-Z\s]+?)(?:\s+(254[0-9]{9}|07[0-9]{8}|01[0-9]{8}))?\s+on\b/i) ||
                      cleanText.match(/from\s+(254[0-9]{9}|07[0-9]{8}|01[0-9]{8})/i)

  let senderName: string | undefined = undefined
  let senderPhone: string | undefined = undefined

  if (senderMatch) {
    if (senderMatch[1] && isNaN(Number(senderMatch[1]))) {
      senderName = senderMatch[1].trim()
    }
    if (senderMatch[2]) {
      senderPhone = senderMatch[2].trim()
    } else if (senderMatch[1] && !isNaN(Number(senderMatch[1]))) {
      senderPhone = senderMatch[1].trim()
    }
  }

  // 4. Extract Recipient (for customer SMS)
  // Handles "paid to METARDU.", "paid to METARDU on", "sent to 3370347 - METARDU on"
  const recipientMatch = cleanText.match(/(?:paid to|sent to)\s+([^.]*?)(?:\.|\s+on\b)/i)
  const recipient = recipientMatch && recipientMatch[1].trim().length > 0 ? recipientMatch[1].trim() : undefined

  // 5. Extract Date/Time if present
  const dateMatch = cleanText.match(/on\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})\s+at\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)/i)
  const timestamp = dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : undefined

  if (!mpesaCode) {
    return {
      success: false,
      rawText: cleanText,
      error: 'Could not detect a valid Safaricom transaction code (e.g. SHK489XZY1)',
    }
  }

  return {
    success: true,
    mpesaCode,
    amount,
    currency: 'KES',
    senderName,
    senderPhone,
    recipient,
    timestamp,
    rawText: cleanText,
  }
}
