import { cookies } from 'next/headers'
import { createTranslator, defaultLanguage, isLanguage } from './shared'
import type { Language } from './messages'

export async function getRequestLanguage(): Promise<Language> {
  const cookieStore = await cookies()
  const cookieLang = cookieStore.get('geonova_language')?.value
  if (isLanguage(cookieLang)) return cookieLang
  return defaultLanguage
}

export async function getServerTranslator(language?: Language): Promise<(key: string, values?: Record<string, string | number>) => string> {
  const lang = language ?? await getRequestLanguage()
  return createTranslator(lang)
}

