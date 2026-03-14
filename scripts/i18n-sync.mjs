import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const messagesDir = path.join(repoRoot, 'messages')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function applyAliases(localeObj) {
  // Historical key typo(s)
  if (localeObj?.traverse?.radiale && !localeObj?.traverse?.radial) {
    localeObj.traverse.radial = localeObj.traverse.radiale
    delete localeObj.traverse.radiale
  }
  return localeObj
}

function mergeInOrder(base, target) {
  if (!isPlainObject(base) || !isPlainObject(target)) {
    return target === undefined ? base : target
  }

  const result = {}

  for (const key of Object.keys(base)) {
    if (key in target) {
      result[key] = mergeInOrder(base[key], target[key])
    } else {
      result[key] = base[key]
    }
  }

  for (const key of Object.keys(target)) {
    if (!(key in base)) {
      result[key] = target[key]
    }
  }

  return result
}

const enPath = path.join(messagesDir, 'en.json')
const en = readJson(enPath)

const files = fs
  .readdirSync(messagesDir)
  .filter((f) => f.endsWith('.json') && f !== 'en.json')
  .sort()

let changed = 0

for (const file of files) {
  const filePath = path.join(messagesDir, file)
  const beforeRaw = fs.readFileSync(filePath, 'utf8')
  const localeObj = applyAliases(readJson(filePath))

  const merged = mergeInOrder(en, localeObj)
  const afterRaw = JSON.stringify(merged, null, 2) + '\n'

  if (afterRaw !== beforeRaw) {
    fs.writeFileSync(filePath, afterRaw, 'utf8')
    changed++
  }
}

console.log(`i18n-sync: updated ${changed} file(s)`)

