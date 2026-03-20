import { Resend } from 'resend'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}
import { NextRequest, NextResponse } from 'next/server'


const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://geonova-henna.vercel.app'


export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    // Internal endpoint — only callable with service role key header
    const authHeader = req.headers.get('authorization')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, name, trialEndDate } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const formattedDate = new Date(trialEndDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const resend = getResend()
    if (!resend) return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'GeoNova <hello@geonova.app>',
      to: email,
      subject: 'Your GeoNova Pro trial ends in 3 days',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0a0a0f; padding: 40px; text-align: center;">
            <h1 style="color: #E8841A; font-size: 32px; margin: 0;">GEONOVA</h1>
            <p style="color: #888; margin: 8px 0 0;">Professional Surveying Platform</p>
          </div>
          
          <div style="padding: 40px; background: #111;">
            <h2 style="color: #fff;">Your Pro trial ends soon!</h2>
            
            <p style="color: #ccc;">
              Hi${name ? ` ${name}` : ''}, your 14-day Pro trial ends on <strong style="color: #E8841A;">${formattedDate}</strong>.
            </p>
            
            <p style="color: #ccc;">
              After that you'll be moved to the Free plan which includes:
            </p>
            
            <ul style="color: #888; line-height: 2; margin: 16px 0; padding-left: 20px;">
              <li>1 project</li>
              <li>50 survey points</li>
              <li>Basic PDF reports</li>
            </ul>
            
            <p style="color: #ccc;">
              <strong style="color: #E8841A;">Upgrade to Pro (KES 500/month)</strong> to keep:
            </p>
            
            <ul style="color: #ccc; line-height: 2; margin: 16px 0; padding-left: 20px;">
              <li>Unlimited projects</li>
              <li>Unlimited survey points</li>
              <li>Full PDF reports</li>
              <li>DXF export for AutoCAD</li>
              <li>GPS stakeout mode</li>
              <li>Priority support</li>
            </ul>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${BASE}/pricing"
                style="background: #E8841A; color: #000; padding: 14px 32px;
                border-radius: 6px; text-decoration: none; font-weight: bold;
                font-size: 16px; display: inline-block;">
                Upgrade Now →
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
              GeoNova — Built for surveyors, by a surveyor.<br>
              © 2026 GeoNova. All rights reserved.
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
