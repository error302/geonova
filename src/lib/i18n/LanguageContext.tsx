'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Language, TranslationKey } from './translations'

interface LanguageContextType {
  language: Language
  t: (key: TranslationKey) => string
  setLanguage: (lang: Language) => void
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: (key) => translations.en[key] || key,
  setLanguage: () => {},
  isRTL: false
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')
  const [isRTL, setIsRTL] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('geonova_language') as Language
    if (saved && translations[saved]) {
      setLanguageState(saved)
      setIsRTL(saved === 'ar')
      document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr'
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    setIsRTL(lang === 'ar')
    localStorage.setItem('geonova_language', lang)
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key
  }

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
  { code: 'pt' as Language, flag: '🇦🇴', name: 'Português' }
]
