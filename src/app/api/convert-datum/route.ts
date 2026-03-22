import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function POST(req: NextRequest) {
  try {
    const { coords = [], fromDatum = 'WGS84', toDatum = 'ARC1960' } = await req.json()

    if (!Array.isArray(coords)) {
      return NextResponse.json({ error: 'coords must be an array' }, { status: 400 })
    }

    const script = `
import sys
sys.path.insert(0, 'src/lib/python')
from datum_converter import batch_convert
import json
coords = ${JSON.stringify(coords)}
results = batch_convert(coords, '${fromDatum}', '${toDatum}')
print(json.dumps(results))
`

    const output = await runPython(script)
    return NextResponse.json(JSON.parse(output))
  } catch (err) {
    return NextResponse.json({ error: 'Datum conversion failed', detail: String(err) }, { status: 500 })
  }
}

function runPython(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-c', script])
    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { console.error(d.toString()) })
    proc.on('close', (code: number) => {
      if (code !== 0) reject(new Error(`Python exited ${code}`))
      else resolve(output)
    })
  })
}
