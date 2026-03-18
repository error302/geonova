'use client'

import Link from 'next/link'

export default function SubscriptionCancelPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-lg bg-[#111] border border-[#222] rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
        <p className="text-gray-400 mb-6">No charges were made. You can try again any time.</p>
        <div className="flex gap-3">
          <Link
            href="/checkout"
            className="flex-1 text-center py-3 bg-[#E8841A] text-black rounded-lg hover:bg-[#d47619]"
          >
            Return to Checkout
          </Link>
          <Link
            href="/pricing"
            className="flex-1 text-center py-3 border border-[#333] text-gray-200 rounded-lg hover:bg-[#0f172a]"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}

