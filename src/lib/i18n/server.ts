import { cookies } from 'next/headers'
import { createTranslator, defaultLanguage, isLanguage } from './shared'
import type { Language } from './messages'

export function getRequestLanguage(): Language {
  const cookieLang = cookies().get('geonova_language')?.value
  if (isLanguage(cookieLang)) return cookieLang
  return defaultLanguage
}

export function getServerTranslator(language?: Language) {
  return createTranslator(language ?? getRequestLanguage())
}

