'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import CrossSectionRenderer, { type CrossSectionProps } from './CrossSectionRenderer'

// ─── TYPES ─────────────────────────────────────────────────────────────────────

export interface SectionData {
  chainage: number
  groundPoints: Array<{ offset: number; level: number }>
  formationLevel: number
  cutArea?: number
  fillArea?: number
}

export interface CrossSectionSeriesProps {
  sections: SectionData[]
  template: CrossSectionProps['template']
  interval?: number
}

interface SectionSummary {
  chainage: number
  cutArea: number
  fillArea: number
  isMaxCut: boolean
  isMaxFill: boolean
  sectionType: 'cut' | 'fill' | 'level' | 'mixed'
}

// ─── THUMBNAIL CROSS-SECTION ──────────────────────────────────────────────────

function ThumbnailSection({
  section,
  template,
  summary,
  isSelected,
  onClick,
}: {
  section: SectionData
  template: CrossSectionProps['template']
  summary: SectionSummary
  isSelected: boolean
  onClick: () => void
}) {
  const borderColor = summary.isMaxCut
    ? 'border-red-500 ring-2 ring-red-500/30'
    : summary.isMaxFill
      ? 'border-blue-500 ring-2 ring-blue-500/30'
      : isSelected
        ? 'border-amber-500 ring-2 ring-amber-500/30'
        : 'border-border'

  const bgColor = summary.isMaxCut
    ? 'bg-red-50 dark:bg-red-950/30'
    : summary.isMaxFill
      ? 'bg-blue-50 dark:bg-blue-950/30'
      : 'bg-white dark:bg-zinc-900'

  const typeColor =
    summary.sectionType === 'cut'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
      : summary.sectionType === 'fill'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
        : summary.sectionType === 'mixed'
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-shrink-0 rounded-lg border-2 overflow-hidden transition-all duration-200',
        'hover:shadow-md hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        borderColor,
        bgColor
      )}
      aria-label={`Cross-section at chainage ${section.chainage}`}
    >
      <div className="w-[200px] h-[100px]">
        <CrossSectionRenderer
          chainage={section.chainage}
          groundPoints={section.groundPoints}
          template={template}
          formationLevel={section.formationLevel}
          cutArea={section.cutArea}
          fillArea={section.fillArea}
          width={200}
          height={100}
          showLabels={false}
        />
      </div>
      <div className="px-2 py-1.5 border-t border-border">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-mono font-semibold truncate">
            CH {(section.chainage / 1000).toFixed(1)}+{(section.chainage % 1000).toFixed(0).padStart(3, '0')}
          </span>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-medium',
              typeColor
            )}
          >
            {summary.sectionType.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5 text-[9px] font-mono text-muted-foreground">
          <span className="text-red-600 dark:text-red-400">
            C:{summary.cutArea.toFixed(1)}
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            F:{summary.fillArea.toFixed(1)}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── MAIN SERIES COMPONENT ────────────────────────────────────────────────────

export function CrossSectionSeries({
  sections,
  template,
  interval = 20,
}: CrossSectionSeriesProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Compute summaries for each section
  const summaries = useMemo<SectionSummary[]>(() => {
    if (sections.length === 0) return []

    let maxCutArea = 0
    let maxFillArea = 0

    const computed = sections.map((section) => {
      const cutArea = section.cutArea ?? 0
      const fillArea = section.fillArea ?? 0

      // Determine section type from areas
      let sectionType: SectionSummary['sectionType'] = 'level'
      if (cutArea > 0.01 && fillArea > 0.01) {
        sectionType = 'mixed'
      } else if (cutArea > 0.01) {
        sectionType = 'cut'
      } else if (fillArea > 0.01) {
        sectionType = 'fill'
      }

      if (cutArea > maxCutArea) maxCutArea = cutArea
      if (fillArea > maxFillArea) maxFillArea = fillArea

      return {
        chainage: section.chainage,
        cutArea,
        fillArea,
        isMaxCut: false,
        isMaxFill: false,
        sectionType,
      }
    })

    // Mark max cut and max fill sections
    // In case of ties, mark all sections with the max value
    for (const s of computed) {
      if (s.cutArea > 0 && Math.abs(s.cutArea - maxCutArea) < 0.01) {
        s.isMaxCut = true
      }
      if (s.fillArea > 0 && Math.abs(s.fillArea - maxFillArea) < 0.01) {
        s.isMaxFill = true
      }
    }

    return computed
  }, [sections])

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCut = summaries.reduce((s, v) => s + v.cutArea, 0)
    const totalFill = summaries.reduce((s, v) => s + v.fillArea, 0)
    const cutCount = summaries.filter(s => s.sectionType === 'cut' || s.sectionType === 'mixed').length
    const fillCount = summaries.filter(s => s.sectionType === 'fill' || s.sectionType === 'mixed').length
    const maxCutSection = summaries.find(s => s.isMaxCut)
    const maxFillSection = summaries.find(s => s.isMaxFill)

    return {
      totalCut,
      totalFill,
      netArea: totalCut - totalFill,
      cutCount,
      fillCount,
      maxCutSection,
      maxFillSection,
      sectionCount: sections.length,
    }
  }, [summaries, sections.length])

  const selectedSection = selectedIdx !== null ? sections[selectedIdx] : null
  const selectedSummary = selectedIdx !== null ? summaries[selectedIdx] : null

  const handleSelect = useCallback((idx: number) => {
    setSelectedIdx(idx)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedIdx(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedIdx === null) return
      if (e.key === 'ArrowRight' && selectedIdx < sections.length - 1) {
        setSelectedIdx(selectedIdx + 1)
        // Scroll the selected thumbnail into view
        const container = scrollRef.current
        if (container) {
          const thumbnailWidth = 208 // 200 + 8 gap
          container.scrollLeft += thumbnailWidth
        }
      } else if (e.key === 'ArrowLeft' && selectedIdx > 0) {
        setSelectedIdx(selectedIdx - 1)
        const container = scrollRef.current
        if (container) {
          const thumbnailWidth = 208
          container.scrollLeft -= thumbnailWidth
        }
      } else if (e.key === 'Escape') {
        setSelectedIdx(null)
      }
    },
    [selectedIdx, sections.length]
  )

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 mb-3 opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
          <p className="text-sm font-medium">No cross-section data</p>
          <p className="text-xs mt-1">
            Add ground profile points and formation levels to generate cross-sections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="space-y-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listbox"
      aria-label="Cross-section series"
    >
      {/* ── Summary Stats Bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <Badge variant="outline" className="text-xs font-mono">
          {stats.sectionCount} sections
        </Badge>
        <Badge variant="outline" className="text-xs font-mono text-red-600 border-red-200 dark:text-red-400 dark:border-red-800">
          Cut: {stats.totalCut.toFixed(1)} m&sup2; ({stats.cutCount})
        </Badge>
        <Badge variant="outline" className="text-xs font-mono text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800">
          Fill: {stats.totalFill.toFixed(1)} m&sup2; ({stats.fillCount})
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-mono',
            stats.netArea >= 0
              ? 'text-red-600 border-red-200 dark:text-red-400 dark:border-red-800'
              : 'text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800'
          )}
        >
          Net: {Math.abs(stats.netArea).toFixed(1)} m&sup2;{' '}
          {stats.netArea >= 0 ? '(cut)' : '(fill)'}
        </Badge>
        {stats.maxCutSection && (
          <Badge variant="outline" className="text-xs font-mono text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/50">
            Max cut: CH {stats.maxCutSection.chainage.toFixed(0)} ({stats.maxCutSection.cutArea.toFixed(1)} m&sup2;)
          </Badge>
        )}
        {stats.maxFillSection && (
          <Badge variant="outline" className="text-xs font-mono text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50">
            Max fill: CH {stats.maxFillSection.chainage.toFixed(0)} ({stats.maxFillSection.fillArea.toFixed(1)} m&sup2;)
          </Badge>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          Interval: {interval}m
        </div>
      </div>

      {/* ── Thumbnail Strip ── */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin"
        role="list"
      >
        {sections.map((section, idx) => (
          <div
            key={section.chainage}
            className="snap-start"
            role="option"
            aria-selected={selectedIdx === idx}
          >
            <ThumbnailSection
              section={section}
              template={template}
              summary={summaries[idx]}
              isSelected={selectedIdx === idx}
              onClick={() => handleSelect(idx)}
            />
          </div>
        ))}
      </div>

      {/* ── Navigation Hints ── */}
      <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span>Click a section to view details</span>
        {selectedIdx !== null && (
          <span className="font-mono">
            Use &larr; &rarr; arrow keys to navigate &bull; Esc to close
          </span>
        )}
      </div>

      {/* ── Expanded Detail Dialog ── */}
      <Dialog
        open={selectedIdx !== null}
        onOpenChange={(open) => {
          if (!open) handleClose()
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {selectedSection && selectedSummary && (
            <>
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono">
                    Cross-Section at CH{' '}
                    {selectedSection.chainage.toFixed(1)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      selectedSummary.sectionType === 'cut' &&
                        'text-red-600 border-red-200 dark:text-red-400',
                      selectedSummary.sectionType === 'fill' &&
                        'text-blue-600 border-blue-200 dark:text-blue-400',
                      selectedSummary.sectionType === 'mixed' &&
                        'text-purple-600 border-purple-200 dark:text-purple-400'
                    )}
                  >
                    {selectedSummary.sectionType.toUpperCase()}
                  </Badge>
                  {selectedSummary.isMaxCut && (
                    <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                      MAX CUT
                    </Badge>
                  )}
                  {selectedSummary.isMaxFill && (
                    <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      MAX FILL
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detailed cross-section view for chainage{' '}
                  {selectedSection.chainage}
                </DialogDescription>
              </DialogHeader>

              {/* Full-size renderer */}
              <div className="px-4 pb-2">
                <CrossSectionRenderer
                  chainage={selectedSection.chainage}
                  groundPoints={selectedSection.groundPoints}
                  template={template}
                  formationLevel={selectedSection.formationLevel}
                  cutArea={selectedSection.cutArea}
                  fillArea={selectedSection.fillArea}
                  width={800}
                  height={400}
                  showLabels={true}
                />
              </div>

              {/* Detail data table */}
              <div className="px-6 pb-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">
                      Formation Level
                    </span>
                    <span className="text-sm font-mono font-semibold">
                      {selectedSection.formationLevel.toFixed(3)} m
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">
                      Cut Area
                    </span>
                    <span className="text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                      {selectedSummary.cutArea.toFixed(3)} m&sup2;
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">
                      Fill Area
                    </span>
                    <span className="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {selectedSummary.fillArea.toFixed(3)} m&sup2;
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">
                      Net Area
                    </span>
                    <span
                      className={cn(
                        'text-sm font-mono font-semibold',
                        (selectedSummary.cutArea - selectedSummary.fillArea) >= 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {Math.abs(
                        selectedSummary.cutArea - selectedSummary.fillArea
                      ).toFixed(3)}{' '}
                      m&sup2;{' '}
                      {(selectedSummary.cutArea - selectedSummary.fillArea) >= 0
                        ? '(cut)'
                        : '(fill)'}
                    </span>
                  </div>
                </div>

                {/* Template info */}
                <div className="mt-4 pt-3 border-t">
                  <span className="text-xs text-muted-foreground block mb-2">
                    Road Template
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground">CW: </span>
                      {template.carriagewayWidth}m
                    </div>
                    <div>
                      <span className="text-muted-foreground">SH: </span>
                      {template.shoulderWidth}m
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cut: </span>
                      {template.cutSlope}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fill: </span>
                      {template.fillSlope}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Camber: </span>
                      {template.camber}%
                    </div>
                    <div>
                      <span className="text-muted-foreground">SG: </span>
                      {template.subgradeDepth}m
                    </div>
                  </div>
                </div>

                {/* Prev/Next navigation */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() =>
                      selectedIdx !== null &&
                      selectedIdx > 0 &&
                      setSelectedIdx(selectedIdx - 1)
                    }
                    disabled={selectedIdx === 0}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    &larr; Previous Section
                  </button>
                  <span className="text-xs text-muted-foreground font-mono">
                    {selectedIdx !== null ? selectedIdx + 1 : 0} of{' '}
                    {sections.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      selectedIdx !== null &&
                      selectedIdx < sections.length - 1 &&
                      setSelectedIdx(selectedIdx + 1)
                    }
                    disabled={selectedIdx === sections.length - 1}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Next Section &rarr;
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CrossSectionSeries
