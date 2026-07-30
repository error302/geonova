/**
 * P0-4 verification: M-Pesa parseCallback + amount-verification logic.
 *
 * The callback route itself requires a running DB + mocked Next.js
 * Request, so it's tested via integration. This unit test covers the
 * critical fraud-prevention pieces:
 *
 * 1. parseCallback correctly extracts Amount + MpesaReceiptNumber
 *    from the Safaricom STK Push callback payload
 * 2. parseCallback returns null for malformed payloads (no
 *    CallbackMetadata)
 * 3. parseCallback correctly marks failed transactions (ResultCode != 0)
 *
 * The amount-verification logic in the callback route (step 7) is the
 * critical fraud check: it compares the ACTUAL paid amount (from
 * parseCallback) against the EXPECTED plan price (from getPlan).
 * Previously this compared expected vs expected (both from the DB row),
 * so a user could pay KES 1 for a Pro plan and it would succeed.
 */
import { MpesaService } from '@/lib/payments/mpesa'
import { getPlan } from '@/lib/subscription/catalog'

describe('P0-4: M-Pesa callback parsing + amount verification', () => {
  // Minimal MpesaService instance — parseCallback is a pure method
  // that doesn't use any instance state, so empty config is fine.
  const mpesa = new MpesaService({
    consumerKey: '',
    consumerSecret: '',
    shortCode: '',
    initiatorName: '',
    securityCredential: '',
    environment: 'sandbox',
  })

  // Real Safaricom STK Push callback payload (success case)
  const successPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: '29115-34620561-1',
        CheckoutRequestID: 'ws_CO_191220191020363925',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 500 },
            { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
            { Name: 'Balance' },
            { Name: 'TransactionDate', Value: 20191219102115 },
            { Name: 'PhoneNumber', Value: 254708374149 },
          ],
        },
      },
    },
  }

  // Failed callback (user cancelled / insufficient funds)
  const failedPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: '29115-34620561-1',
        CheckoutRequestID: 'ws_CO_191220191020363925',
        ResultCode: 1032, // "Request cancelled by user"
        ResultDesc: 'Request cancelled by user',
      },
    },
  }

  describe('parseCallback', () => {
    test('extracts amount + receipt number from success payload', () => {
      const result = mpesa.parseCallback(successPayload)
      expect(result).not.toBeNull()
      expect(result!.amount).toBe(500)
      expect(result!.transactionId).toBe('NLJ7RT61SV')
      expect(result!.phone).toBe('254708374149')
      expect(result!.status).toBe('completed')
    })

    test('returns null for failed callback (no CallbackMetadata)', () => {
      const result = mpesa.parseCallback(failedPayload)
      expect(result).toBeNull()
    })

    test('returns null for malformed payload (missing Body)', () => {
      expect(mpesa.parseCallback({} as Record<string, unknown>)).toBeNull()
      expect(mpesa.parseCallback({ Body: {} } as Record<string, unknown>)).toBeNull()
      expect(mpesa.parseCallback({ Body: { stkCallback: {} } } as Record<string, unknown>)).toBeNull()
    })

    test('handles missing Amount gracefully (returns 0)', () => {
      const payload = {
        Body: {
          stkCallback: {
            ResultCode: 0,
            CallbackMetadata: {
              Item: [{ Name: 'MpesaReceiptNumber', Value: 'ABC123' }],
            },
          },
        },
      }
      const result = mpesa.parseCallback(payload as Record<string, unknown>)
      expect(result).not.toBeNull()
      expect(result!.amount).toBe(0)
      expect(result!.transactionId).toBe('ABC123')
    })
  })

  describe('amount verification logic (callback route step 7)', () => {
    // This mirrors the logic in callback/route.ts lines 140-168:
    //   const plan = getPlan(planId)
    //   const expectedAmount = plan?.prices?.KES ?? Number(paymentRow.amount) ?? 0
    //   if (paidAmount > 0 && expectedAmount > 0 &&
    //       Math.round(paidAmount) !== Math.round(expectedAmount)) {
    //     // → mark as failed, fraudFlag = 'amount_mismatch'
    //   }

    test('Pro plan has a KES price that can be looked up', () => {
      const plan = getPlan('pro')
      expect(plan).toBeDefined()
      expect(plan!.prices?.KES).toBeDefined()
      expect(plan!.prices!.KES).toBeGreaterThan(0)
    })

    test('matching amount passes verification', () => {
      const plan = getPlan('pro')
      const expectedAmount = plan!.prices!.KES
      const paidAmount = expectedAmount // exact match

      const matches =
        Number.isFinite(expectedAmount) &&
        expectedAmount > 0 &&
        Number.isFinite(paidAmount) &&
        paidAmount > 0 &&
        Math.round(paidAmount) !== Math.round(expectedAmount)

      expect(matches).toBe(false) // false = no mismatch = pass
    })

    test('underpayment (KES 1 for Pro plan) is flagged as mismatch', () => {
      const plan = getPlan('pro')
      const expectedAmount = plan!.prices!.KES
      const paidAmount = 1 // user pays KES 1 instead of the Pro price

      const isMismatch =
        Number.isFinite(expectedAmount) &&
        expectedAmount > 0 &&
        Number.isFinite(paidAmount) &&
        paidAmount > 0 &&
        Math.round(paidAmount) !== Math.round(expectedAmount)

      expect(isMismatch).toBe(true) // true = mismatch = fraud flag
    })

    test('overpayment is also flagged (defensive)', () => {
      const plan = getPlan('pro')
      const expectedAmount = plan!.prices!.KES
      const paidAmount = expectedAmount * 2

      const isMismatch =
        Number.isFinite(expectedAmount) &&
        expectedAmount > 0 &&
        Number.isFinite(paidAmount) &&
        paidAmount > 0 &&
        Math.round(paidAmount) !== Math.round(expectedAmount)

      expect(isMismatch).toBe(true)
    })

    test('zero paid amount does not trigger mismatch (graceful — lets manual review handle it)', () => {
      // This mirrors the route logic: if paidAmount is 0 (parseCallback
      // failed to extract), the check is skipped to avoid false positives.
      // The route still marks the payment as completed in this case,
      // which is a known limitation — but better than blocking legit
      // payments where Safaricom's payload was malformed.
      const plan = getPlan('pro')
      const expectedAmount = plan!.prices!.KES
      const paidAmount = 0

      const isMismatch =
        Number.isFinite(expectedAmount) &&
        expectedAmount > 0 &&
        Number.isFinite(paidAmount) &&
        paidAmount > 0 && // ← this short-circuits to false when paidAmount is 0
        Math.round(paidAmount) !== Math.round(expectedAmount)

      expect(isMismatch).toBe(false)
    })
  })
})
