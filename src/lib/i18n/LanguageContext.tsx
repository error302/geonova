'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createTranslator, defaultLanguage, isLanguage } from './shared'
import type { Language } from './messages'

interface LanguageContextType {
  language: Language
  t: (key: string, values?: Record<string, string | number>) => string
  setLanguage: (lang: Language) => void
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  language: defaultLanguage,
  t: (key) => key,
  setLanguage: () => {},
  isRTL: false
})

function setLanguageCookie(lang: Language) {
  const maxAgeSeconds = 60 * 60 * 24 * 365
  document.cookie = `geonova_language=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)
  const [isRTL, setIsRTL] = useState(false)

  useEffect(() => {
    const savedRaw = localStorage.getItem('geonova_language')
    const saved = isLanguage(savedRaw) ? savedRaw : null

    const browser = navigator.language?.split('-')[0]?.toLowerCase()
    const detected = isLanguage(browser) ? browser : null

    const initial = (saved ?? detected ?? defaultLanguage) as Language

    setLanguageState(initial)
    setIsRTL(initial === 'ar')
    document.documentElement.dir = initial === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = initial
    localStorage.setItem('geonova_language', initial)
    setLanguageCookie(initial)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    setIsRTL(lang === 'ar')
    localStorage.setItem('geonova_language', lang)
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    setLanguageCookie(lang)
  }

  const t = createTranslator(language)

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)

export const languages = [
  { code: 'en' as Language, flag: '🇬🇧', name: 'English' },
  { code: 'sw' as Language, flag: '🇰🇪', name: 'Kiswahili' },
  { code: 'fr' as Language, flag: '🇫🇷', name: 'Français' },
  { code: 'ar' as Language, flag: '🇸🇦', name: 'العربية' },
  { code: 'pt' as Language, flag: '🇦🇴', name: 'Português' },
  { code: 'es' as Language, flag: '🇪🇸', name: 'Español' },
  { code: 'zh' as Language, flag: '🇨🇳', name: '中文' },
  { code: 'ja' as Language, flag: '🇯🇵', name: '日本語' },
  { code: 'ru' as Language, flag: '🇷🇺', name: 'Русский' },
  { code: 'hi' as Language, flag: '🇮🇳', name: 'हिन्दी' },
  { code: 'id' as Language, flag: '🇮🇩', name: 'Bahasa Indonesia' },
  { code: 'am' as Language, flag: '🇪🇹', name: 'አማርኛ' },
  { code: 'ha' as Language, flag: '🇳🇬', name: 'Hausa' },
  { code: 'de' as Language, flag: '🇩🇪', name: 'Deutsch' },
]
