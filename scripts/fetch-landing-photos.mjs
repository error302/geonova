#!/usr/bin/env node
/**
 * Fetch real survey photography for the landing page backgrounds.
 *
 * The landing page currently uses the project's own generated/screenshot
 * assets (public/landing/*.webp) which the owner wanted replaced with high
 * quality photos of real surveying scenes. External free-photo APIs were
 * rate-limiting during the 2026-08-14 pass (Wikimedia 429, Pexels 403,
 * Unsplash 401/503), so this script fetches a curated set of free-licensed
 * (Wikimedia Commons) survey photos once the rate limit clears.
 *
 * Usage:
 *   node scripts/fetch-landing-photos.mjs
 *
 * It downloads each image at 1920px into public/landing/ and prints the
 * author + license so you can add attribution to public/landing/CREDITS.md.
 *
 * After downloading, wire them into src/app/page.tsx by pointing the section
 * backgrounds at the new files:
 *   hero        -> public/landing/hero-survey.jpg
 *   GNSS card   -> public/landing/bg-gnss.jpg
 *   workflow    -> public/landing/bg-field.jpg
 *   deed plan   -> public/landing/bg-cadastral.jpg
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'public', 'landing')
const UA = 'METARDU-asset-fetcher/1.0 (contact: support@metardu.space)'

// [filename, Commons file title]
const TARGETS = [
  ['hero-survey.jpg', 'File:Topographic survey of a bridge.jpg'],
  ['bg-gnss.jpg', 'File:GNSS receiver Hoogengraven.jpg'],
  ['bg-field.jpg', 'File:Archaeologists surveying in a trench.jpg'],
  ['bg-cadastral.jpg', 'File:Cadastre de Gigord.jpg'],
]

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

async function download(url, file) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${file}`))
      const ws = fs.createWriteStream(file)
      res.pipe(ws)
      ws.on('finish', () => { ws.close(); resolve() })
      ws.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const [file, title] of TARGETS) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1920&format=json`
    try {
      const r = await getJson(api)
      const pages = Object.values(r.query?.pages ?? {})
      const ii = pages[0]?.imageinfo?.[0]
      if (!ii?.thumburl) { console.log(`skip ${file}: no image found`); continue }
      const out = path.join(OUT_DIR, file)
      await download(ii.thumburl, out)
      const lic = ii.extmetadata?.LicenseShortName?.value ?? 'unknown'
      const artist = (ii.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '')
      console.log(`OK ${file} (${(fs.statSync(out).size / 1024).toFixed(0)}KB) license=${lic} author=${artist}`)
      console.log(`   source: https://commons.wikimedia.org/wiki/${title.replace(/ /g, '_')}`)
    } catch (e) {
      console.log(`ERR ${file}: ${e.message}`)
    }
    await new Promise((r) => setTimeout(r, 10000)) // be polite to the API
  }
  console.log('Done. Update public/landing/CREDITS.md with the licenses/authors above.')
}

main()
