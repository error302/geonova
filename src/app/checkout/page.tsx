'use client'

import { useState } from 'react'
import {
  getPaymentMethods,
  createPaymentIntent,
  getCurrencyForCountry,
  SUBSCRIPTION_PLANS,
  SubscriptionPlan
} from '@/lib/enterprise'

export default function CheckoutPage() {
  const [step, setStep] = useState(1)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [country, setCountry] = useState('Kenya')
  const [currency, setCurrency] = useState('KES')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const paymentMethods = getPaymentMethods(country)

  const handleCountryChange = (c: string) => {
    setCountry(c)
    setCurrency(getCurrencyForCountry(c))
  }

  const handleSubscribe = async () => {
    if (!selectedPlan || !paymentMethod) return
    
    setProcessing(true)
    
    const intent = createPaymentIntent(
      selectedPlan.price,
      currency,
      paymentMethod as any
    )

    setTimeout(() => {
      setProcessing(false)
      setPaymentSuccess(true)
    }, 2000)
  }

  const formatPrice = (price: number) => {
    const symbol = currency === 'KES' ? 'KES' : currency === 'USD' ? '$' : currency
    return `${symbol} ${price.toLocaleString()}`
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">Your {selectedPlan?.name} subscription is now active.</p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
        <p className="text-gray-600 mb-8">Complete your subscription payment</p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${
                step >= s ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Select Plan</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full p-3 border rounded-lg"
              >
                <option value="Kenya">Kenya</option>
                <option value="Uganda">Uganda</option>
                <option value="Tanzania">Tanzania</option>
                <option value="Nigeria">Nigeria</option>
                <option value="Ghana">Ghana</option>
                <option value="South Africa">South Africa</option>
              </select>
            </div>

            <div className="space-y-3">
              {SUBSCRIPTION_PLANS.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                    selectedPlan?.id === plan.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <p className="text-sm text-gray-500">{plan.storageGb}GB storage • {plan.teamMembersLimit === -1 ? 'Unlimited' : plan.teamMembersLimit} users</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatPrice(plan.price)}</p>
                      <p className="text-xs text-gray-500">/year</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!selectedPlan}
              className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Payment Details</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full p-3 border rounded-lg"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 700 000 000"
                className="w-full p-3 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                For M-Pesa/Airtel Money STK push
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="space-y-2">
                {paymentMethods.map(pm => (
                  <label
                    key={pm.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                      paymentMethod === pm.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={pm.type}
                      checked={paymentMethod === pm.id}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mr-3"
                    />
                    <span>{pm.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!paymentMethod || !email}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Review Order
              </button>
            </div>
          </div>
        )}

        {step === 3 && selectedPlan && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Confirm Order</h2>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">{selectedPlan.name} Plan</span>
                <span className="font-medium">{formatPrice(selectedPlan.price)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Processing Fee</span>
                <span className="font-medium">{formatPrice(0)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">{formatPrice(selectedPlan.price)}</span>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-6">
              <p>Payment will be processed via {paymentMethods.find(p => p.type === paymentMethod)?.name}</p>
              <p className="mt-1">You will receive an STK push on your phone</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleSubscribe}
                disabled={processing}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
              >
                {processing ? 'Processing...' : `Pay ${formatPrice(selectedPlan.price)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
