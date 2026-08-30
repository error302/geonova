'use client'

import { useState } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2, Smartphone, ShieldCheck, Copy, Check, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getMpesaTillNumber } from '@/lib/payments/mpesaConfig'
import { parseMpesaSms } from '@/lib/payments/smsParser'

export interface MpesaCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  planId: 'pro' | 'team' | 'firm' | 'enterprise'
  planName: string
  amountKes: number
  userEmail?: string
  userName?: string
}

export function MpesaCheckoutModal({
  isOpen,
  onClose,
  planId,
  planName,
  amountKes,
  userEmail = '',
  userName = '',
}: MpesaCheckoutModalProps) {
  const router = useRouter()
  const [mpesaCode, setMpesaCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState(userEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [copiedTill, setCopiedTill] = useState(false)
  const [showSmsPaste, setShowSmsPaste] = useState(false)
  const [parsedMsg, setParsedMsg] = useState('')

  const TILL_NUMBER = getMpesaTillNumber()

  if (!isOpen) return null

  const handleCopyTill = () => {
    navigator.clipboard.writeText(TILL_NUMBER)
    setCopiedTill(true)
    setTimeout(() => setCopiedTill(false), 2500)
  }

  const handleSmsPaste = (text: string) => {
    if (!text.trim()) return
    const parsed = parseMpesaSms(text)
    if (parsed.success && parsed.mpesaCode) {
      setMpesaCode(parsed.mpesaCode)
      if (parsed.senderPhone && !phoneNumber) {
        setPhoneNumber(parsed.senderPhone)
      }
      setParsedMsg(`✓ Safaricom code ${parsed.mpesaCode} detected${parsed.amount ? ` (KSh ${parsed.amount.toLocaleString()})` : ''}`)
      setTimeout(() => setParsedMsg(''), 5000)
    } else {
      setParsedMsg('Could not detect a 10-char M-Pesa code from pasted text. Please enter it manually.')
    }
  }

  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/payments/mpesa/verify-till', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          mpesaCode: mpesaCode.trim().toUpperCase(),
          phoneNumber: phoneNumber.trim(),
          userEmail: email.trim(),
          userName: userName.trim(),
        }),
      })

      const data = (await res.json()) as { error?: string; success?: boolean; status?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed. Please check your transaction code.')
      }

      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify M-Pesa code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Lipa na M-Pesa Buy Goods</h3>
              <p className="text-xs text-[var(--text-muted)]">Manual verification against the merchant statement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {success ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-[var(--text-primary)]">Payment Submitted</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  We received your <strong className="text-white">{planName}</strong> payment claim. Your plan activates
                  as soon as the M-Pesa transaction is confirmed — usually within a few hours.
                </p>
              </div>

              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl font-mono text-xs text-left space-y-1.5 text-[var(--text-secondary)]">
                <div className="flex justify-between">
                  <span>M-Pesa Ref:</span>
                  <span className="text-[var(--accent)] font-bold">{mpesaCode.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Till Number:</span>
                  <span className="text-white">{TILL_NUMBER}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="text-emerald-400 font-bold">KSh {amountKes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-amber-300 font-bold">Pending verification</span>
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                A confirmation email has been sent to your registered address. We verify every Till
                payment against the merchant M-Pesa statement to keep the platform fraud-free.
              </p>

              <button
                onClick={() => {
                  onClose()
                  router.push('/dashboard')
                }}
                className="w-full py-3 bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-sm rounded-xl hover:bg-[var(--accent-dim)] transition-colors"
              >
                Go to Workspace →
              </button>
            </div>
          ) : (
            <>
              {/* Till Number Card */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    M-Pesa Buy Goods Till
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20">
                    Official Till
                  </span>
                </div>
                <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5">
                  <div>
                    <div className="text-[11px] text-[var(--text-muted)]">Till Number:</div>
                    <div className="text-2xl font-mono font-black text-emerald-400 tracking-wider">
                      {TILL_NUMBER}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyTill}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/20 transition-colors"
                  >
                    {copiedTill ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTill ? 'Copied!' : 'Copy Till'}</span>
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-muted)]">Plan: <strong className="text-white">{planName}</strong></span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">KSh {amountKes.toLocaleString()}</span>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                <div className="font-semibold text-[var(--text-primary)]">Simple 4-Step Instructions:</div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[var(--text-muted)]">
                  <li>Open M-Pesa on your phone $\to$ <strong className="text-white">Lipa na M-Pesa</strong>.</li>
                  <li>Select <strong className="text-white">Buy Goods and Services</strong>.</li>
                  <li>Enter Till Number <strong className="text-emerald-400">{TILL_NUMBER}</strong>.</li>
                  <li>Enter Amount <strong className="text-white">KSh {amountKes.toLocaleString()}</strong> and enter your PIN.</li>
                </ol>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleVerifyPayment} className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">
                      M-Pesa Transaction Code *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSmsPaste(!showSmsPaste)}
                      className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{showSmsPaste ? 'Hide SMS paste' : 'Paste full SMS'}</span>
                    </button>
                  </div>

                  {showSmsPaste && (
                    <div className="mb-2 p-2.5 bg-black/30 border border-white/10 rounded-lg space-y-1.5 animate-in fade-in duration-200">
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Paste the full confirmation SMS you received from Safaricom:
                      </div>
                      <textarea
                        rows={2}
                        placeholder="e.g. SHK489XZY1 Confirmed. Ksh500.00 paid to METARDU on 30/8/26 at 3:30 PM..."
                        onChange={(e) => handleSmsPaste(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded p-2 text-xs text-white placeholder-[var(--text-muted)] font-mono outline-none focus:border-[var(--accent)] resize-none"
                      />
                    </div>
                  )}

                  {parsedMsg && (
                    <div className="mb-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                      {parsedMsg}
                    </div>
                  )}

                  <input
                    type="text"
                    required
                    placeholder="e.g. SHK489XZY1 or RJH9283741"
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                    className="input w-full font-mono text-sm uppercase px-3 py-2 text-[var(--accent)] font-bold tracking-wider"
                    maxLength={15}
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Copy and paste the 10-character code from your Safaricom SMS.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="0712345678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="input w-full font-mono text-xs px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      Receipt Email
                    </label>
                    <input
                      type="email"
                      placeholder="surveyor@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input w-full font-mono text-xs px-3 py-2"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !mpesaCode.trim()}
                  className="w-full py-3 bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-sm rounded-xl hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting payment for review…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Submit Payment for Verification</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
