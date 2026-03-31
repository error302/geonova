import { Resend } from 'resend'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/security/rateLimit'


const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu-henna.vercel.app'


export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()

    const { allowed, remaining } = await rateLimit(email || 'anonymous', 5, 3600000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const resend = getResend()
    if (!resend) return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'METARDU <hello@metardu.app>',
      to: email,
      subject: 'Welcome to METARDU — Your Pro Trial Has Started',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0a0a0f; padding: 40px; text-align: center;">
            <h1 style="color: #E8841A; font-size: 32px; margin: 0;">METARDU</h1>
            <p style="color: #888; margin: 8px 0 0;">Professional Surveying Platform</p>
          </div>
          
          <div style="padding: 40px; background: #111;">
            <h2 style="color: #fff;">Welcome to METARDU${name ? `, ${name}` : ''}!</h2>
            
            <p style="color: #ccc;">
              Your 14-day Pro trial has started. You now have access to 
              all Pro features including unlimited projects, PDF reports, 
              DXF export, and GPS stakeout.
            </p>
            
            <div style="background: #1a1a2e; border: 1px solid #E8841A33; 
              border-radius: 8px; padding: 20px; margin: 24px 0;">
              <h3 style="color: #E8841A; margin: 0 0 12px;">
                What you can do right now:
              </h3>
              <ul style="color: #ccc; line-height: 2; margin: 0; padding-left: 20px;">
                <li>Create unlimited survey projects</li>
                <li>Run traverse adjustments with Bowditch method</li>
                <li>Generate professional PDF reports</li>
                <li>Export to DXF for AutoCAD</li>
                <li>Use GPS stakeout in the field</li>
                <li>Process field notes automatically</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${BASE}/dashboard"
                style="background: #E8841A; color: #000; padding: 14px 32px;
                border-radius: 6px; text-decoration: none; font-weight: bold;
                font-size: 16px; display: inline-block;">
                Open METARDU →
              </a>
            </div>
            
            <p style="color: #888; font-size: 14px;">
              Questions? Reply to this email or visit our 
              <a href="${BASE}/docs" 
                style="color: #E8841A;">documentation</a>.
            </p>
          </div>
          
          <div style="background: #0a0a0f; padding: 20px; text-align: center;">
            <p style="color: #444; font-size: 12px; margin: 0;">
              METARDU — Built for surveyors, by a surveyor.<br>
              © 2026 METARDU. All rights reserved.
            </p>
          </div>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
