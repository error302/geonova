import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import zh from '../../../messages/zh.json'
import hi from '../../../messages/hi.json'
import es from '../../../messages/es.json'
import fr from '../../../messages/fr.json'

export const messagesByLanguage = {
  ar,
  en,
  zh,
  hi,
  es,
  fr,
} as const

export type Language = keyof typeof messagesByLanguage

