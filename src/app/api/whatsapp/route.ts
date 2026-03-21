import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIdentifier } from '@/lib/security/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req)
    const { allowed, remaining } = await rateLimit(identifier, 30, 60000)
    
    if (!allowed) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Too many requests. Please try again in 1 minute.</Message></Response>`,
        { headers: { 'Content-Type': 'text/xml', 'X-RateLimit-Remaining': '0' } }
      )
    }

    const body = await req.text()
    const params = new URLSearchParams(body)
    
    const message = params.get('Body')?.trim().toLowerCase()
    const from = params.get('From')
    
    let response = ''
    
    if (message?.startsWith('distance')) {
      response = parseDistanceCommand(message)
    } else if (message?.startsWith('bearing')) {
      response = parseBearingCommand(message)
    } else if (message?.startsWith('area')) {
      response = parseAreaCommand(message)
    } else if (message?.startsWith('help')) {
      response = `METARDU WhatsApp Bot 📐

Commands:
DISTANCE e1,n1,e2,n2
BEARING e1,n1,e2,n2
AREA p1e,p1n p2e,p2n p3e,p3n...
TRAVERSE startE,startN leg1,leg2...
HELP - show this message

Example:
DISTANCE 484500,9863200,484850,9863450`
    } else if (message?.startsWith('traverse')) {
      response = parseTraverseCommand(message)
    } else {
      response = `Unknown command. Send HELP for available commands.

Quick tips:
• DISTANCE 500000,500000,500100,500100
• BEARING 500000,500000,500100,500100  
• AREA 5000,5000 5100,5000 5100,5100 5000,5100`
    }
    
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${response}</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (error) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Error processing request</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

function parseDistanceCommand(msg: string): string {
  try {
    const parts = msg.replace('distance', '').trim().split(/[,\s]+/)
    if (parts.length < 4) return 'Format: DISTANCE e1,n1,e2,n2'
    
    const e1 = parseFloat(parts[0])
    const n1 = parseFloat(parts[1])
    const e2 = parseFloat(parts[2])
    const n2 = parseFloat(parts[3])
    
    if (isNaN(e1) || isNaN(n1) || isNaN(e2) || isNaN(n2)) {
      return 'Invalid numbers. Format: DISTANCE e1,n1,e2,n2'
    }
    
    const dE = e2 - e1
    const dN = n2 - n1
    const dist = Math.sqrt(dE * dE + dN * dN)
    
    const bearingRad = Math.atan2(dE, dN)
    let bearingDeg = bearingRad * 180 / Math.PI
    if (bearingDeg < 0) bearingDeg += 360
    
    const deg = Math.floor(bearingDeg)
    const min = Math.floor((bearingDeg - deg) * 60)
    const sec = (((bearingDeg - deg) * 60) - min) * 60
    
    return `Distance: ${dist.toFixed(4)} m
Bearing: ${deg}°${min}'${sec.toFixed(1)}"
ΔE: ${dE >= 0 ? '+' : ''}${dE.toFixed(4)} m
ΔN: ${dN >= 0 ? '+' : ''}${dN.toFixed(4)} m`
  } catch {
    return 'Error. Format: DISTANCE e1,n1,e2,n2'
  }
}

function parseBearingCommand(msg: string): string {
  return parseDistanceCommand(msg.replace('bearing', 'distance'))
}

function parseAreaCommand(msg: string): string {
  try {
    const pointsStr = msg.replace('area', '').trim()
    const pointPairs = pointsStr.split(/[\s,]+/)
    const coords: number[] = []
    
    for (const p of pointPairs) {
      const num = parseFloat(p)
      if (!isNaN(num)) coords.push(num)
    }
    
    if (coords.length < 6) return 'Need at least 3 points (6 coords)'
    
    const points: { easting: number; northing: number }[] = []
    for (let i = 0; i < coords.length - 1; i += 2) {
      points.push({ easting: coords[i], northing: coords[i + 1] })
    }
    
    if (points.length < 3) return 'Need at least 3 points'
    
    let sum = 0
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      sum += points[i].easting * points[j].northing
      sum -= points[j].easting * points[i].northing
    }
    const area = Math.abs(sum) / 2
    
    return `Area: ${area.toFixed(4)} m²
${(area / 10000).toFixed(6)} ha
${(area / 4046.8564224).toFixed(4)} acres`
  } catch {
    return 'Error. Format: AREA e1,n1 e2,n2 e3,n3...'
  }
}

function parseTraverseCommand(msg: string): string {
  try {
    const parts = msg.replace('traverse', '').trim().split(/[\s,]+/)
    if (parts.length < 2) return 'Format: TRAVERSE startE,startN leg1_dist,leg1_bearing...'
    
    const startE = parseFloat(parts[0])
    const startN = parseFloat(parts[1])
    
    if (isNaN(startE) || isNaN(startN)) {
      return 'Invalid start point. Format: TRAVERSE e,n leg1,leg2...'
    }
    
    let currentE = startE
    let currentN = startN
    let totalDist = 0
    const legs: string[] = []
    
    for (let i = 2; i < parts.length; i += 2) {
      const dist = parseFloat(parts[i])
      const bearing = parseFloat(parts[i + 1])
      
      if (isNaN(dist) || isNaN(bearing)) continue
      
      const bearingRad = bearing * Math.PI / 180
      const dE = dist * Math.sin(bearingRad)
      const dN = dist * Math.cos(bearingRad)
      
      currentE += dE
      currentN += dN
      totalDist += dist
      
      const deg = Math.floor(bearing)
      const min = Math.floor((bearing - deg) * 60)
      const sec = (((bearing - deg) * 60) - min) * 60
      
      legs.push(`Leg ${(i - 2) / 2 + 1}: ${dist.toFixed(2)}m @ ${deg}°${min}'${sec.toFixed(0)}"`)
    }
    
    return `Traverse Summary:
Start: E${startE.toFixed(2)} N${startN.toFixed(2)}
End: E${currentE.toFixed(2)} N${currentN.toFixed(2)}
Total Distance: ${totalDist.toFixed(2)} m

${legs.join('\n')}`
  } catch {
    return 'Error. Format: TRAVERSE startE,startN leg1,leg2...'
  }
}

export async function GET() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>METARDU WhatsApp Bot is running. POST a message to use.</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
