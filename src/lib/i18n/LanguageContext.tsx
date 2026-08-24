'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createTranslator, defaultLanguage, isLanguage } from './shared'
import type { Language } from './messages'

interface LanguageContextType {
  language: Language
  t: (key: string, values?: Record<string, string | number>) => string
  setLanguage: (lang: Language) => void
  isRTL: boolean
  hydrated: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  language: defaultLanguage,
  t: (key) => key,
  setLanguage: () => {},
  isRTL: false,
  hydrated: false
})

function setLanguageCookie(lang: Language) {
  const maxAgeSeconds = 60 * 60 * 24 * 365
  document.cookie = `metardu_language=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)
  const [isRTL, setIsRTL] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const savedRaw = localStorage.getItem('metardu_language')
    const saved = isLanguage(savedRaw) ? savedRaw : null

    const browser = navigator.language?.split('-')[0]?.toLowerCase()
    const detected = isLanguage(browser) ? browser : null

    const initial = (saved ?? detected ?? defaultLanguage) as Language

    setLanguageState(initial)
    setIsRTL(initial === 'ar')
    document.documentElement.dir = initial === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = initial
    localStorage.setItem('metardu_language', initial)
    setLanguageCookie(initial)
    setHydrated(true)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    setIsRTL(lang === 'ar')
    localStorage.setItem('metardu_language', lang)
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    setLanguageCookie(lang)
  }

  const t = createTranslator(language)

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage, isRTL, hydrated }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)

export const languages = [
  { code: 'en' as Language, flag: 'UK', name: 'English' },
  { code: 'zh' as Language, flag: 'CN', name: '中文' },
  { code: 'hi' as Language, flag: 'IN', name: 'हिन्दी' },
  { code: 'es' as Language, flag: '', name: 'Español' },
  { code: 'ar' as Language, flag: '', name: 'العربية' },
  { code: 'fr' as Language, flag: '', name: 'Français' },
]
