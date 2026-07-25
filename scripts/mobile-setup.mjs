#!/usr/bin/env node
/**
 * mobile-setup.mjs — Initialize the Capacitor Android project for METARDU
 *
 * AUDIT FIX (2026-07-05): The package.json had `mobile:build` and `mobile:sync`
 * scripts that referenced `cd android && ./gradlew assembleDebug`, but no
 * `android/` directory existed. Running `npm run mobile:build` would fail
 * with "no such directory".
 *
 * This script:
 *   1. Verifies the Next.js static export is built (`next build` with MOBILE_BUILD=true)
 *   2. Runs `npx cap add android` if the android/ directory doesn't exist
 *   3. Copies splash screen + app icons into the native project
 *   4. Runs `npx cap sync android` to refresh web assets
 *   5. Prints next steps for the user (open in Android Studio, build APK)
 *
 * Usage:
 *   node scripts/mobile-setup.mjs            # full setup
 *   node scripts/mobile-setup.mjs --sync     # just sync (after web changes)
 *   node scripts/mobile-setup.mjs --check    # check status without modifying
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const ANDROID_DIR = join(ROOT, 'android')
const OUT_DIR = join(ROOT, 'out')
const ICONS_DIR = join(ROOT, 'public', 'icons')

const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has('--check')
const SYNC_ONLY = args.has('--sync')

function log(msg) { console.log(`[mobile-setup] ${msg}`) }
function warn(msg) { console.warn(`[mobile-setup] WARNING: ${msg}`) }
function fail(msg) { console.error(`[mobile-setup] ERROR: ${msg}`); process.exit(1) }

function run(cmd, opts = {}) {
  log(`$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

// ─── Step 1: Check status ────────────────────────────────────────────────────
log('Checking METARDU mobile setup...')

const hasAndroid = existsSync(ANDROID_DIR)
const hasStaticExport = existsSync(OUT_DIR) && existsSync(join(OUT_DIR, 'index.html'))
const hasCapacitorConfig = existsSync(join(ROOT, 'capacitor.config.ts'))

log(`  android/ directory:        ${hasAndroid ? 'present' : 'MISSING'}`)
log(`  out/ static export:        ${hasStaticExport ? 'present' : 'MISSING'}`)
log(`  capacitor.config.ts:       ${hasCapacitorConfig ? 'present' : 'MISSING'}`)

if (!hasCapacitorConfig) {
  fail('capacitor.config.ts is missing. Run `npm install @capacitor/cli @capacitor/core` first.')
}

if (CHECK_ONLY) {
  log('\nCheck complete. Run without --check to set up the project.')
  process.exit(0)
}

// ─── Step 2: Build static export (skip if --sync) ────────────────────────────
if (!SYNC_ONLY) {
  if (!hasStaticExport) {
    log('\nBuilding Next.js static export (MOBILE_BUILD=true)...')
    run('MOBILE_BUILD=true NEXT_PUBLIC_SENTRY_DSN= DISABLE_PWA=true npx next build', {
      env: { ...process.env, MOBILE_BUILD: 'true', NEXT_PUBLIC_SENTRY_DSN: '', DISABLE_PWA: 'true' },
    })
  } else {
    log('\nStatic export already present. (Run with --sync after rebuilding to refresh.)')
  }
}

// ─── Step 3: Add Android platform if missing ─────────────────────────────────
if (!hasAndroid) {
  log('\nAdding Android platform via Capacitor...')
  run('npx cap add android')
} else {
  log('\nandroid/ directory already exists — skipping `cap add android`.')
}

// ─── Step 4: Copy app icons into the Android project ────────────────────────
// Capacitor looks for these in android/app/src/main/res/
const androidResDir = join(ANDROID_DIR, 'app', 'src', 'main', 'res')
if (existsSync(androidResDir) && existsSync(ICONS_DIR)) {
  log('\nCopying app icons to Android resources...')

  // Map our PNG icons to Android mipmap densities
  const iconMap = {
    'icon-72.png': 'mipmap-hdpi/ic_launcher.png',
    'icon-96.png': 'mipmap-xhdpi/ic_launcher.png',
    'icon-144.png': 'mipmap-xxhdpi/ic_launcher.png',
    'icon-192.png': 'mipmap-xxxhdpi/ic_launcher.png',
    'icon-48.png': 'mipmap-mdpi/ic_launcher.png',  // may not exist; skip if absent
  }
  for (const [src, dest] of Object.entries(iconMap)) {
    const srcPath = join(ICONS_DIR, src)
    const destPath = join(androidResDir, dest)
    const destDir = join(androidResDir, dest.split('/')[0])
    if (existsSync(srcPath)) {
      mkdirSync(destDir, { recursive: true })
      copyFileSync(srcPath, destPath)
      log(`  ${src} → ${dest}`)
    }
  }
} else if (!existsSync(androidResDir)) {
  warn('android/app/src/main/res/ not found — skipping icon copy. Run `npx cap add android` first.')
}

// ─── Step 5: Sync web assets to native project ───────────────────────────────
log('\nRunning `npx cap sync android` to refresh web assets...')
run('npx cap sync android')

// ─── Step 6: Print next steps ─────────────────────────────────────────────────
log('\n✓ Mobile setup complete!')
log('')
log('Next steps:')
log('  1. Open in Android Studio:    npm run mobile:open')
log('  2. Build debug APK:           npm run mobile:build')
log('  3. Or build release APK in Android Studio: Build → Generate Signed Bundle/APK')
log('')
log('Before publishing to Play Store:')
log('  - Generate a signed upload key (Android Studio → Build → Generate Signed APK)')
log('  - Set the app version in android/app/build.gradle (versionCode + versionName)')
log('  - Test on at least 3 physical devices (different screen sizes + Android versions)')
log('  - Run `npx cap sync android` after every web change before rebuilding the APK')
