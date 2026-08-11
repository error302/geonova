'use client';

import { useState, useRef, useEffect } from 'react'
import { Pen, Type, FileCheck, Check } from 'lucide-react'
import type { DigitalSignature } from '@/types/signature'
import { logger } from '@/lib/logger'

interface SignatureCaptureProps {
  documentId: string
  documentType: DigitalSignature['documentType']
  documentContent: string
  onSigned: (sig: DigitalSignature) => void
  surveyorName?: string
  iskNumber?: string
}

export default function SignatureCapture({
  documentId,
  documentType,
  documentContent,
  onSigned,
  surveyorName = '',
  iskNumber = ''
}: SignatureCaptureProps) {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'certificate'>('draw')
  const [signatureData, setSignatureData] = useState<string>('')
  const [typedName, setTypedName] = useState(surveyorName)
  const [typedIsk, setTypedIsk] = useState(iskNumber)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [signed, setSigned] = useState(false)
  const [result, setResult] = useState<{ verificationToken: string; signatureId: string } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
      }
    }
  }, [activeTab])

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL('image/png'))
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setSignatureData('')
  }

  const handleSign = async () => {
    const method = activeTab === 'draw' ? 'DRAWN' : 'TYPED'
    const data = activeTab === 'draw' ? signatureData : `TYPED:${typedName}:${typedIsk}`

    if (!data && method === 'DRAWN') return
    if (activeTab === 'type' && (!typedName || !confirmed)) return

    setLoading(true)

    try {
      const res = await fetch('/api/signature/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          documentType,
          content: documentContent,
          method,
          signatureData: data
        })
      })

      const responseData = await res.json() as { verificationToken: string; signatureId: string; documentHash: string }

      if (responseData.verificationToken) {
        setResult({
          verificationToken: responseData.verificationToken,
          signatureId: responseData.signatureId
        })
        setSigned(true)
        onSigned({
          id: responseData.signatureId,
          documentId,
          documentType,
          signedBy: '',
          surveyorName,
          iskNumber: iskNumber || typedIsk,
          firmName: '',
          signedAt: new Date().toISOString(),
          documentHash: responseData.documentHash,
          signatureData: data,
          method: method as 'DRAWN' | 'TYPED',
          valid: true,
          verificationToken: responseData.verificationToken
        })
      }
    } catch (error) {
      logger.error('Sign error:', { error: error })
    }

    setLoading(false)
  }

  if (signed && result) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Check className="w-6 h-6 text-green-600" />
          <h3 className="font-semibold text-green-800">Document Signed Successfully</h3>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="text-gray-500">Verification Token:</span> <code className="bg-white px-2 py-1 rounded">{result.verificationToken}</code></p>
          <p className="text-gray-600">
            This token can be used to verify the document authenticity via QR code or the verification link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('draw')}
          className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'draw' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500'}`}
        >
          <Pen className="w-4 h-4" />
          Draw
        </button>
        <button
          onClick={() => setActiveTab('type')}
          className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'type' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500'}`}
        >
          <Type className="w-4 h-4" />
          Type
        </button>
        <button
          onClick={() => setActiveTab('certificate')}
          className={`flex items-center gap-2 px-4 py-2 ${activeTab === 'certificate' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-gray-500'}`}
          disabled
        >
          <FileCheck className="w-4 h-4" />
          Certificate
        </button>
      </div>

      {activeTab === 'draw' && (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            className="border rounded-lg cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          <button onClick={clearCanvas} className="text-sm text-gray-500 hover:text-gray-700">
            Clear
          </button>
        </div>
      )}

      {activeTab === 'type' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            I, {typedName || '[Name]'}, ISK No. {typedIsk || '[ISK Number]'}, hereby certify this document
            as correct and complete per Survey Act Cap 299 s.17
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="full-name">Full Name</label>
            <input id="full-name"
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
 placeholder="Enter your full name"
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="isk-number">ISK Number</label>
            <input id="isk-number"
              type="text"
              value={typedIsk}
              onChange={e => setTypedIsk(e.target.value)}
 placeholder="e.g., ISK/1234"
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2">
            <input aria-label="ISK Number"
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">I confirm this is my legal signature</span>
          </label>
        </div>
      )}

      {activeTab === 'certificate' && (
        <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-500">
          <p>Coming soon — PKI certificate signing</p>
        </div>
      )}

      <button
        onClick={handleSign}
        disabled={loading || (activeTab === 'draw' && !signatureData) || (activeTab === 'type' && (!typedName || !confirmed))}
        className="w-full py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
      >
        {loading ? 'Signing...' : 'Sign Document'}
      </button>
    </div>
  )
}
