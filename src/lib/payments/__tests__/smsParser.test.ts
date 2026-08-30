/**
 * Safaricom M-Pesa SMS Parser Unit Tests
 */
import { parseMpesaSms } from '../smsParser'

describe('parseMpesaSms', () => {
  test('parses customer confirmation SMS correctly', () => {
    const sms = 'SHK489XZY1 Confirmed. Ksh500.00 paid to METARDU. on 30/8/26 at 3:30 PM. New M-PESA balance is Ksh1,240.00. Transaction cost, Ksh0.00.'
    const res = parseMpesaSms(sms)

    expect(res.success).toBe(true)
    expect(res.mpesaCode).toBe('SHK489XZY1')
    expect(res.amount).toBe(500)
    expect(res.recipient).toContain('METARDU')
    expect(res.timestamp).toBe('30/8/26 3:30 PM')
  })

  test('parses customer SMS with spaces in Ksh amount and Till reference', () => {
    const sms = 'QHK389XZY1 Confirmed. Ksh 5,000.00 sent to 3370347 - METARDU on 30/8/26 at 11:20 AM.'
    const res = parseMpesaSms(sms)

    expect(res.success).toBe(true)
    expect(res.mpesaCode).toBe('QHK389XZY1')
    expect(res.amount).toBe(5000)
    expect(res.recipient).toContain('3370347')
  })

  test('parses merchant notification SMS correctly', () => {
    const sms = 'RJH9283741 Confirmed. You have received Ksh500.00 from JOHN MWANGI 254712345678 on 30/8/26 at 3:30 PM. New Till balance is Ksh15,500.00.'
    const res = parseMpesaSms(sms)

    expect(res.success).toBe(true)
    expect(res.mpesaCode).toBe('RJH9283741')
    expect(res.amount).toBe(500)
    expect(res.senderName).toBe('JOHN MWANGI')
    expect(res.senderPhone).toBe('254712345678')
  })

  test('handles invalid or empty text gracefully', () => {
    expect(parseMpesaSms('').success).toBe(false)
    expect(parseMpesaSms('Hello there no code here').success).toBe(false)
  })
})
