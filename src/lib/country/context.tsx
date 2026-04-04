'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  SurveyingCountry,
  ALL_COUNTRIES,
  getCountryStandard,
  getCountryByISO,
  getTraverseOrderForEnvironment,
  getAreaDecimalPlaces,
  getSlopeRule,
  getBeaconRule,
  getFieldNoteRule,
  getSurveyorReportRequirement,
  type CountrySurveyStandard,
  type TraverseOrderSpec,
  type AreaPrecisionRule,
  type SurveyEnvironment,
} from './standards'

interface CountryContextType {
  country: SurveyingCountry
  standard: CountrySurveyStandard
  t: (key: string, values?: Record<string, string | number>) => string
  setCountry: (country: SurveyingCountry) => void
  getTraverseOrder: (environment: SurveyEnvironment) => TraverseOrderSpec | undefined
  getAreaRule: (sqMetres: number) => AreaPrecisionRule
  getSlope: () => ReturnType<typeof getSlopeRule>
  getBeacon: () => ReturnType<typeof getBeaconRule>
  getFieldNote: () => ReturnType<typeof getFieldNoteRule>
  getReportReq: () => ReturnType<typeof getSurveyorReportRequirement>
  flag: string
  isoCode: string
}

const DEFAULT_COUNTRY: SurveyingCountry = 'kenya'

const CountryContext = createContext<CountryContextType>({
  country: DEFAULT_COUNTRY,
  standard: getCountryStandard(DEFAULT_COUNTRY),
  t: (key) => key,
  setCountry: () => {},
  getTraverseOrder: () => undefined,
  getAreaRule: () => ({ maxHa: Infinity, decimalPlaces: 2, unit: 'm2' as const, regulation: '' }),
  getSlope: () => getSlopeRule(DEFAULT_COUNTRY),
  getBeacon: () => getBeaconRule(DEFAULT_COUNTRY),
  getFieldNote: () => getFieldNoteRule(DEFAULT_COUNTRY),
  getReportReq: () => getSurveyorReportRequirement(DEFAULT_COUNTRY),
  flag: '🇰🇪',
  isoCode: 'KE',
})

function setCountryCookie(country: SurveyingCountry) {
  const maxAgeSeconds = 60 * 60 * 24 * 365
  document.cookie = `metardu_country=${encodeURIComponent(country)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<SurveyingCountry>(DEFAULT_COUNTRY)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const saved = localStorage.getItem('metardu_country') as SurveyingCountry | null
    if (saved && ALL_COUNTRIES.some((c: any) => c.id === saved)) {
      setCountryState(saved)
      return
    }

    try {
      const cookies = Object.fromEntries(
        document.cookie.split('; ').map((c: any) => c.split('='))
      )
      if (cookies['metardu_country']) {
        const cookieCountry = decodeURIComponent(cookies['metardu_country']) as SurveyingCountry
        if (ALL_COUNTRIES.some((c: any) => c.id === cookieCountry)) {
          setCountryState(cookieCountry)
        }
      }
    } catch {}

    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => {
        if (data?.country_code) {
          const match = getCountryByISO(data.country_code)
          if (match) {
            setCountryState(match.country)
            localStorage.setItem('metardu_country', match.country)
          }
        }
      })
      .catch(() => {})
  }, [])

  const standard = getCountryStandard(country)
  const countryInfo = ALL_COUNTRIES.find((c: any) => c.id === country)

  function setCountry(c: SurveyingCountry) {
    setCountryState(c)
    localStorage.setItem('metardu_country', c)
    setCountryCookie(c)
  }

  const getAreaRule = (sqMetres: number) => getAreaDecimalPlaces(country, sqMetres)
  const getSlope = () => getSlopeRule(country)
  const getBeacon = () => getBeaconRule(country)
  const getFieldNote = () => getFieldNoteRule(country)
  const getReportReq = () => getSurveyorReportRequirement(country)

  return (
    <CountryContext.Provider
      value={{
        country,
        standard,
        t: (key) => key,
        setCountry,
        getTraverseOrder: (env) => getTraverseOrderForEnvironment(country, env),
        getAreaRule,
        getSlope,
        getBeacon,
        getFieldNote,
        getReportReq,
        flag: countryInfo?.flag ?? '🌍',
        isoCode: countryInfo?.isoCode ?? 'XX',
      }}
    >
      {children}
    </CountryContext.Provider>
  )
}

export const useCountry = () => useContext(CountryContext)

export { ALL_COUNTRIES, getCountryStandard, getCountryByISO, getTraverseOrderForEnvironment }
export type { SurveyingCountry, CountrySurveyStandard, TraverseOrderSpec, AreaPrecisionRule }
