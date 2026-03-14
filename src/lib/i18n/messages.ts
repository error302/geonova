import en from '../../../messages/en.json'
import sw from '../../../messages/sw.json'
import fr from '../../../messages/fr.json'
import ar from '../../../messages/ar.json'
import pt from '../../../messages/pt.json'
import es from '../../../messages/es.json'
import zh from '../../../messages/zh.json'
import ja from '../../../messages/ja.json'
import ru from '../../../messages/ru.json'
import hi from '../../../messages/hi.json'
import id from '../../../messages/id.json'
import am from '../../../messages/am.json'
import ha from '../../../messages/ha.json'
import de from '../../../messages/de.json'

export const messagesByLanguage = {
  en,
  sw,
  fr,
  ar,
  pt,
  es,
  zh,
  ja,
  ru,
  hi,
  id,
  am,
  ha,
  de,
} as const

export type Language = keyof typeof messagesByLanguage

