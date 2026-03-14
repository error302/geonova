import { messagesByLanguage, type Language } from './messages'

export const defaultLanguage: Language = 'en'

export function isLanguage(value: string | undefined | null): value is Language {
  if (!value) return false
  return value in messagesByLanguage
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj) return undefined
  const parts = path.split('.').filter(Boolean)
  let current: any = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      return undefined
    }
  }
  return current
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined || value === null ? `{${key}}` : String(value)
  })
}

export function createTranslator(language: Language) {
  const primary = messagesByLanguage[language]
  const fallback = messagesByLanguage[defaultLanguage]

  return (key: string, values?: Record<string, string | number>): string => {
    const primaryValue = getNestedValue(primary, key)
    if (typeof primaryValue === 'string') return interpolate(primaryValue, values)

    const fallbackValue = getNestedValue(fallback, key)
    if (typeof fallbackValue === 'string') return interpolate(fallbackValue, values)

    return key
  }
}

