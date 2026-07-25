#!/usr/bin/env node
/**
 * NextAuth v4 → v5 migration codemod
 *
 * Transforms:
 *   import { getServerSession } from 'next-auth'
 *   import { authOptions } from '@/lib/auth'
 *   const session = await getServerSession(authOptions)
 *
 * Into:
 *   import { auth } from '@/lib/auth-v5'
 *   const session = await auth()
 *
 * Usage (dry-run first):
 *   node scripts/auth-v5-codemod.js --dry-run
 *   node scripts/auth-v5-codemod.js          # writes changes
 *
 * Per skill-creator skill: this is a deterministic script, not LLM work.
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.resolve(__dirname, '..', 'src')
const DRY_RUN = process.argv.includes('--dry-run')

let filesScanned = 0
let filesChanged = 0
let replacements = 0

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      transformFile(fullPath)
    }
  }
}

function transformFile(filePath) {
  filesScanned++
  const original = fs.readFileSync(filePath, 'utf8')
  let content = original
  let changed = false

  // 1. Replace: import { getServerSession } from 'next-auth'
  //    + import { authOptions } from '@/lib/auth'
  //    With: import { auth } from '@/lib/auth-v5'
  const hasGetServerSession = /import\s*\{\s*getServerSession\s*\}\s*from\s*['"]next-auth['"]/.test(content)
  const hasAuthOptionsImport = /import\s*\{\s*authOptions\s*\}\s*from\s*['"]@\/lib\/auth['"]/.test(content)

  if (hasGetServerSession || hasAuthOptionsImport) {
    // Remove the getServerSession import line
    content = content.replace(
      /import\s*\{\s*getServerSession\s*\}\s*from\s*['"]next-auth['"]\s*;?\n/g,
      ''
    )

    // Replace authOptions import with auth import from auth-v5
    if (hasAuthOptionsImport) {
      content = content.replace(
        /import\s*\{\s*authOptions\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n/g,
        "import { auth } from '@/lib/auth-v5'\n"
      )
    } else if (hasGetServerSession) {
      // If only getServerSession was imported (no authOptions), add auth import
      // Insert at top of file after the first comment block
      content = "import { auth } from '@/lib/auth-v5'\n" + content
    }
    changed = true
  }

  // 2. Replace: getServerSession(authOptions) → auth()
  const callPattern = /getServerSession\s*\(\s*authOptions\s*\)/g
  const callMatches = content.match(callPattern) || []
  if (callMatches.length > 0) {
    content = content.replace(callPattern, 'auth()')
    replacements += callMatches.length
    changed = true
  }

  // 3. Replace: getServerSession(authOptions, req) → auth()  (with request arg)
  // NextAuth v5 auth() doesn't take args — the request is inferred from context
  const callPatternWithArg = /getServerSession\s*\(\s*authOptions\s*,\s*[^)]+\)/g
  const callMatchesWithArg = content.match(callPatternWithArg) || []
  if (callMatchesWithArg.length > 0) {
    content = content.replace(callPatternWithArg, 'auth()')
    replacements += callMatchesWithArg.length
    changed = true
  }

  if (changed) {
    filesChanged++
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf8')
    }
    console.log(`${DRY_RUN ? '[dry-run]' : '[wrote]'} ${path.relative(SRC_DIR, filePath)}`)
  }
}

console.log(`NextAuth v4 → v5 codemod — ${DRY_RUN ? 'DRY RUN' : 'WRITING'}`)
console.log(`Scanning: ${SRC_DIR}\n`)

walk(SRC_DIR)

console.log(`\n---`)
console.log(`Files scanned: ${filesScanned}`)
console.log(`Files ${DRY_RUN ? 'would change' : 'changed'}: ${filesChanged}`)
console.log(`Call-site replacements: ${replacements}`)
console.log(`\nNext steps:`)
console.log(`  1. npm install next-auth@beta`)
console.log(`  2. Run Prisma migration for v5 schema`)
console.log(`  3. Update src/app/api/auth/[...nextauth]/route.ts`)
console.log(`  4. Run this codemod (without --dry-run)`)
console.log(`  5. Test all auth flows`)
