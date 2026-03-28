'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  parseParcelNumber, 
  lookupRegistrationSection, 
  getUTMZoneForParcel,
  type ParsedParcelNumber 
} from '@/lib/compute/parcelNumber'
import { KENYA_COUNTIES, type RegistrationSection } from '@/lib/data/kenyaLocalities'

interface ParcelNumberInputProps {
  value: string
  onChange: (value: string, parsed: ParsedParcelNumber) => void
  onUTMZoneDetected?: (zone: number, hemisphere: 'N' | 'S') => void
  disabled?: boolean
  required?: boolean
}

export default function ParcelNumberInput({ 
  value, 
  onChange, 
  onUTMZoneDetected,
  disabled,
  required 
}: ParcelNumberInputProps) {
  const [parsed, setParsed] = useState<ParsedParcelNumber>(parseParcelNumber(value))
  const [inputMode, setInputMode] = useState<'free' | 'structured'>('free')
  
  // Structured input fields
  const [selectedCounty, setSelectedCounty] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [blockNumber, setBlockNumber] = useState('')
  const [parcelNumber, setParcelNumber] = useState('')

  const sections = selectedCounty 
    ? KENYA_COUNTIES.find(c => c.code === selectedCounty)?.registrationSections || []
    : []

  const currentSection = sections.find(s => s.code === selectedSection)

  // Parse free-text input
  useEffect(() => {
    const result = parseParcelNumber(value)
    setParsed(result)
    
    // Update structured fields if we have a match
    if (result.registrationSection) {
      const section = lookupRegistrationSection(result.registrationSection)
      if (section) {
        const county = KENYA_COUNTIES.find(c => c.code === section.county)
        if (county) {
          setSelectedCounty(county.code)
          setSelectedSection(section.code)
          if (result.block) setBlockNumber(String(result.block))
          if (result.parcelNumber) setParcelNumber(String(result.parcelNumber))
        }
      }
    }
    
    // Auto-detect UTM zone
    if (result.registrationSection && result.isValid) {
      const { zone, hemisphere } = getUTMZoneForParcel(result.registrationSection)
      onUTMZoneDetected?.(zone, hemisphere)
    }
  }, [value, onUTMZoneDetected])

  const handleFreeTextChange = (text: string) => {
    const result = parseParcelNumber(text)
    setParsed(result)
    onChange(text, result)
    
    if (result.registrationSection && result.isValid) {
      const { zone, hemisphere } = getUTMZoneForParcel(result.registrationSection)
      onUTMZoneDetected?.(zone, hemisphere)
    }
  }

  const handleStructuredChange = useCallback(() => {
    if (!selectedSection || !parcelNumber) return
    
    let rawValue: string
    if (currentSection?.hasBlocks && blockNumber) {
      const sectionName = currentSection.name.split(' ')[0]
      rawValue = `${sectionName} BLOCK ${blockNumber}/${parcelNumber}`
    } else {
      rawValue = `${selectedSection}/${parcelNumber}`
    }
    
    const result = parseParcelNumber(rawValue)
    setParsed(result)
    onChange(rawValue, result)
    
    const { zone, hemisphere } = getUTMZoneForParcel(selectedSection)
    onUTMZoneDetected?.(zone, hemisphere)
  }, [selectedSection, blockNumber, parcelNumber, currentSection, onChange, onUTMZoneDetected])

  return (
    <div className="space-y-4">
      {/* Input mode toggle */}
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setInputMode('free')}
          className={`px-3 py-1 rounded ${inputMode === 'free' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)]'}`}
        >
          Free Text
        </button>
        <button
          type="button"
          onClick={() => setInputMode('structured')}
          className={`px-3 py-1 rounded ${inputMode === 'structured' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)]'}`}
        >
          Structured
        </button>
      </div>

      {inputMode === 'free' ? (
        <div>
          <input
            type="text"
            value={value}
            onChange={e => handleFreeTextChange(e.target.value)}
            disabled={disabled}
            required={required}
            placeholder="e.g. NAIROBI BLOCK 2/1234 or KIAMBU/456"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">County</label>
            <select
              value={selectedCounty}
              onChange={e => {
                setSelectedCounty(e.target.value)
                setSelectedSection('')
              }}
              disabled={disabled}
              className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm"
            >
              <option value="">Select County</option>
              {KENYA_COUNTIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={e => {
                setSelectedSection(e.target.value)
                handleStructuredChange()
              }}
              disabled={disabled || !selectedCounty}
              className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm"
            >
              <option value="">Select Section</option>
              {sections.map(s => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>
          
          {currentSection?.hasBlocks && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Block</label>
              <input
                type="number"
                value={blockNumber}
                onChange={e => {
                  setBlockNumber(e.target.value)
                  handleStructuredChange()
                }}
                disabled={disabled}
                placeholder="1"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm"
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Parcel No.</label>
            <input
              type="number"
              value={parcelNumber}
              onChange={e => {
                setParcelNumber(e.target.value)
                handleStructuredChange()
              }}
              disabled={disabled}
              required={required}
              placeholder="1234"
              className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm"
            />
          </div>
        </div>
      )}

      {/* Validation feedback */}
      {parsed.isValid ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <span>✓</span>
            <span>Valid parcel number</span>
          </div>
          {parsed.formatted && (
            <div className="mt-2 text-xs space-y-1">
              <div><span className="text-[var(--text-muted)]">Canonical:</span> {parsed.formatted}</div>
              <div><span className="text-[var(--text-muted)]">Short:</span> {parsed.shortForm}</div>
              {parsed.county && (
                <div><span className="text-[var(--text-muted)]">County:</span> {parsed.county}</div>
              )}
              {parsed.registrationSection && (
                <div><span className="text-[var(--text-muted)]">Section:</span> {parsed.registrationSection}</div>
              )}
              <div className="text-[var(--accent)] font-medium mt-1">
                UTM Zone: {getUTMZoneForParcel(parsed.registrationSection || '').zone}
                {getUTMZoneForParcel(parsed.registrationSection || '').hemisphere}
              </div>
            </div>
          )}
        </div>
      ) : (
        parsed.validationErrors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 text-sm mb-1">
              <span>⚠</span>
              <span>Invalid</span>
            </div>
            <ul className="text-xs text-red-600 space-y-1">
              {parsed.validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  )
}
