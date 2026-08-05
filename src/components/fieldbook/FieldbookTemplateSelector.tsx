'use client';

/**
 * FieldbookTemplateSelector
 * --------------------------
 * Pre-defined templates for common Kenya survey operations.
 *
 * Templates pre-fill column visibility, default values, and
 * computation settings, reducing setup time for standard operations
 * following Survey of Kenya (SoK) conventions.
 *
 * Templates:
 *   - SoK Standard Traverse: Face Left / Face Right, Kenya bearing format
 *   - SoK Leveling: Rise & Fall method with standard columns
 *   - Control Radiation: Radiation observations from known stations
 *   - Route Traverse: Optimized for road corridor surveys
 *   - Boundary Survey: Cadastral boundary surveys with beacon references
 */

import { useState, useMemo } from 'react';
import {
  Compass,
  Ruler,
  MapPin,
  Route,
  Landmark,
  CheckCircle2,
  ChevronRight,
  Info,
  BookOpen,
  X,
} from 'lucide-react';
import type { FieldbookType } from '@/app/fieldbook/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface FieldbookTemplateColumn {
  key: string;
  label: string;
  visible: boolean;
  required?: boolean;
  width?: string;
  placeholder?: string;
  defaultValue?: string;
}

export interface FieldbookTemplateConfig {
  /** Template ID */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Survey type this template applies to */
  surveyType: FieldbookType;
  /** Icon component type */
  iconType: 'compass' | 'ruler' | 'mapPin' | 'route' | 'landmark';
  /** Column configuration */
  columns: FieldbookTemplateColumn[];
  /** Default computation settings */
  defaults: Record<string, string | number | boolean>;
  /** Kenya regulation reference */
  regulationRef?: string;
  /** Tags for filtering */
  tags: string[];
}

interface FieldbookTemplateSelectorProps {
  /** Currently active survey type — used to filter relevant templates */
  currentType?: FieldbookType;
  /** Called when a template is selected */
  onSelectTemplate: (template: FieldbookTemplateConfig) => void;
  /** Currently applied template ID */
  activeTemplateId?: string | null;
  /** Whether to show in compact mode (e.g., in sidebar) */
  compact?: boolean;
}

// ─── Template Definitions ───────────────────────────────────────────────

const TEMPLATES: FieldbookTemplateConfig[] = [
  {
    id: 'sok-traverse',
    name: 'SoK Standard Traverse',
    description: 'Face Left / Face Right observation method with Kenya-standard DDD.MMSS bearing format. Follows Survey of Kenya field book conventions for traverse observations.',
    surveyType: 'traverse',
    iconType: 'compass',
    columns: [
      { key: 'station', label: 'Station', visible: true, required: true, placeholder: 'A1' },
      { key: 'hclDeg', label: 'HCL °', visible: true, placeholder: '45.3015' },
      { key: 'hclMin', label: "HCL '", visible: true, placeholder: '' },
      { key: 'hclSec', label: 'HCL "', visible: true, placeholder: '' },
      { key: 'hcrDeg', label: 'HCR °', visible: true, placeholder: '225.3015' },
      { key: 'hcrMin', label: "HCR '", visible: true, placeholder: '' },
      { key: 'hcrSec', label: 'HCR "', visible: true, placeholder: '' },
      { key: 'bearing', label: 'Mean Bearing', visible: true, placeholder: 'Auto' },
      { key: 'slopeDist', label: 'Slope Dist', visible: true, required: true, placeholder: '125.456' },
      { key: 'vaDeg', label: 'VA (DDD.MMSS)', visible: true, placeholder: '90.0000' },
      { key: 'ih', label: 'HI (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'th', label: 'TH (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'remarks', label: 'Remarks', visible: true, placeholder: 'Beacon found, concrete' },
    ],
    defaults: {
      travMode: 'closed',
      bearingFormat: 'DDD.MMSS',
      showFaceLeft: true,
      showFaceRight: true,
      autoMeanBearing: true,
    },
    regulationRef: 'SoK Field Book Convention — Reg 67',
    tags: ['sok', 'traverse', 'face-left-right', 'standard'],
  },
  {
    id: 'sok-leveling',
    name: 'SoK Leveling',
    description: 'Rise & Fall method with standard BS/IS/FS columns following Survey of Kenya specifications. Includes arithmetic check and allowable misclosure per distance.',
    surveyType: 'leveling',
    iconType: 'ruler',
    columns: [
      { key: 'station', label: 'Station / TP', visible: true, required: true, placeholder: 'BM1' },
      { key: 'bs', label: 'BS', visible: true, placeholder: '1.245' },
      { key: 'is', label: 'IS', visible: true, placeholder: '1.502' },
      { key: 'fs', label: 'FS', visible: true, placeholder: '0.873' },
      { key: 'rise', label: 'Rise', visible: true, placeholder: 'Auto' },
      { key: 'fall', label: 'Fall', visible: true, placeholder: 'Auto' },
      { key: 'rl', label: 'RL', visible: true, placeholder: 'Auto' },
      { key: 'remarks', label: 'Remarks', visible: true, placeholder: 'Concrete BM, flush' },
    ],
    defaults: {
      levelMethod: 'rise_and_fall',
      openingRL: '100.0000',
      distanceKm: '1',
      showArithmeticCheck: true,
    },
    regulationRef: 'SoK Leveling Standard — 12√K mm',
    tags: ['sok', 'leveling', 'rise-and-fall', 'standard'],
  },
  {
    id: 'control-radiation',
    name: 'Control Radiation',
    description: 'Pre-configured for radiation observations from known control stations. Includes instrument height, target height, bearing, vertical angle, and slope distance.',
    surveyType: 'control',
    iconType: 'mapPin',
    columns: [
      { key: 'pointId', label: 'Point ID', visible: true, required: true, placeholder: 'P1' },
      { key: 'instrumentHeight', label: 'HI (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'targetHeight', label: 'TH (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'bearing', label: 'Bearing (DDD.MMSS)', visible: true, required: true, placeholder: '45.3015' },
      { key: 'verticalAngle', label: 'VA (DDD.MMSS)', visible: true, placeholder: '90.0000' },
      { key: 'slopeDistance', label: 'Slope Dist (m)', visible: true, required: true, placeholder: '85.234' },
      { key: 'remarks', label: 'Remarks', visible: true, placeholder: 'Beacon / detail point' },
    ],
    defaults: {
      instrumentHeight: '1.500',
      targetHeight: '1.500',
      verticalAngle: '90.0000',
      computeCoordinates: true,
    },
    tags: ['control', 'radiation', 'coordinates', '3d-polar'],
  },
  {
    id: 'route-traverse',
    name: 'Route Traverse',
    description: 'Optimized for road corridor surveys with chainage and offset columns. Pre-configured for linear infrastructure projects under Kenya Roads Board specifications.',
    surveyType: 'traverse',
    iconType: 'route',
    columns: [
      { key: 'station', label: 'Chainage', visible: true, required: true, placeholder: '0+000' },
      { key: 'bearing', label: 'Bearing', visible: true, required: true, placeholder: '45.3015' },
      { key: 'slopeDist', label: 'Distance', visible: true, required: true, placeholder: '50.000' },
      { key: 'offset', label: 'Offset (m)', visible: true, placeholder: '0.000' },
      { key: 'vaDeg', label: 'VA', visible: true, placeholder: '90.0000' },
      { key: 'ih', label: 'HI (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'th', label: 'TH (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'remarks', label: 'Remarks', visible: true, placeholder: 'CL / LT / RT' },
    ],
    defaults: {
      travMode: 'open',
      bearingFormat: 'DDD.MMSS',
      chainageFormat: '0+000',
      showOffsets: true,
    },
    regulationRef: 'Kenya Roads Board — Route Survey Spec',
    tags: ['route', 'road', 'corridor', 'chainage', 'infrastructure'],
  },
  {
    id: 'boundary-survey',
    name: 'Boundary Survey',
    description: 'Optimized for cadastral boundary surveys with beacon references. Follows Land Registration Act and Survey Act Cap 299 requirements for legal boundary definition.',
    surveyType: 'traverse',
    iconType: 'landmark',
    columns: [
      { key: 'station', label: 'Beacon Ref', visible: true, required: true, placeholder: 'LR/1234/1' },
      { key: 'bearing', label: 'Bearing (DDD.MMSS)', visible: true, required: true, placeholder: '45.3015' },
      { key: 'slopeDist', label: 'Distance (m)', visible: true, required: true, placeholder: '125.456' },
      { key: 'vaDeg', label: 'VA', visible: true, placeholder: '90.0000' },
      { key: 'ih', label: 'HI (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'th', label: 'TH (m)', visible: true, defaultValue: '1.500', placeholder: '1.500' },
      { key: 'beaconType', label: 'Beacon Type', visible: true, placeholder: 'Concrete / Pipe' },
      { key: 'remarks', label: 'Remarks', visible: true, placeholder: 'Found / Established / Renewed' },
    ],
    defaults: {
      travMode: 'closed',
      bearingFormat: 'DDD.MMSS',
      requireBowditchAdjustment: true,
      minimumPrecision: '1:5000',
      showBeaconReference: true,
    },
    regulationRef: 'Survey Act Cap 299 — Boundary Survey',
    tags: ['boundary', 'cadastral', 'beacon', 'legal', 'cap-299'],
  },
];

// ─── Icon helper ────────────────────────────────────────────────────────

function TemplateIcon({ type, className }: { type: FieldbookTemplateConfig['iconType']; className?: string }) {
  const iconClass = className ?? 'w-5 h-5';
  switch (type) {
    case 'compass':
      return <Compass className={iconClass} />;
    case 'ruler':
      return <Ruler className={iconClass} />;
    case 'mapPin':
      return <MapPin className={iconClass} />;
    case 'route':
      return <Route className={iconClass} />;
    case 'landmark':
      return <Landmark className={iconClass} />;
  }
}

// ─── Template Card ──────────────────────────────────────────────────────

function TemplateCard({
  template,
  isActive,
  onSelect,
  compact,
}: {
  template: FieldbookTemplateConfig;
  isActive: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={[
        'rounded-xl border transition-all',
        isActive
          ? 'border-[var(--accent)]/50 bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/20'
          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--accent)]/30',
      ].join(' ')}
    >
      <button
        onClick={onSelect}
        className="w-full text-left p-3 flex items-start gap-3"
      >
        <div className={[
          'grid place-items-center w-9 h-9 rounded-lg shrink-0',
          isActive
            ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
        ].join(' ')}>
          <TemplateIcon type={template.iconType} className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {template.name}
            </span>
            {isActive && (
              <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
            )}
          </div>
          {!compact && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
              {template.description}
            </p>
          )}
          {template.regulationRef && !compact && (
            <p className="text-[10px] text-[var(--accent)]/70 mt-1">
              [Book] {template.regulationRef}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-1" />
      </button>

      {/* Expandable details */}
      {!compact && !isActive && (
        <div className="px-3 pb-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
          >
            <Info className="w-3 h-3" />
            {expanded ? 'Hide columns' : 'Show columns'} ({template.columns.length})
          </button>
          {expanded && (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {template.columns.map((col) => (
                <div
                  key={col.key}
                  className={[
                    'flex items-center gap-1.5 px-2 py-1 rounded text-[10px]',
                    col.visible
                      ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] line-through',
                  ].join(' ')}
                >
                  {col.visible ? (
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                  )}
                  <span className="truncate">{col.label}</span>
                  {col.required && (
                    <span className="text-red-400">*</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {!compact && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-muted)] uppercase tracking-wider"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function FieldbookTemplateSelector({
  currentType,
  onSelectTemplate,
  activeTemplateId,
  compact = false,
}: FieldbookTemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Filter templates by survey type and search query
  const filteredTemplates = useMemo(() => {
    let filtered = TEMPLATES;

    if (currentType && !showAll) {
      filtered = filtered.filter((t) => t.surveyType === currentType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }

    return filtered;
  }, [currentType, showAll, searchQuery]);

  const activeTemplate = TEMPLATES.find((t) => t.id === activeTemplateId);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-[var(--accent)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Templates
        </h3>
        {activeTemplate && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--accent)] font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            {activeTemplate.name}
          </span>
        )}
      </div>

      {/* Search */}
      {!compact && (
        <input
          type="text"
          aria-label="Search templates" placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
        />
      )}

      {/* Type filter toggle */}
      {!compact && currentType && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(false)}
            className={[
              'px-2.5 py-1 text-xs rounded-lg border transition',
              !showAll
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)] font-semibold'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)]',
            ].join(' ')}
          >
            {currentType.charAt(0).toUpperCase() + currentType.slice(1)}
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={[
              'px-2.5 py-1 text-xs rounded-lg border transition',
              showAll
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)] font-semibold'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)]',
            ].join(' ')}
          >
            All
          </button>
        </div>
      )}

      {/* Template list */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
        {filteredTemplates.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">
            No templates found
          </p>
        ) : (
          filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isActive={activeTemplateId === template.id}
              onSelect={() => onSelectTemplate(template)}
              compact={compact}
            />
          ))
        )}
      </div>

      {/* Info note */}
      {!compact && (
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          Templates pre-configure column visibility, default values, and computation settings for common Kenya survey operations. Select a template to apply its configuration.
        </p>
      )}
    </div>
  );
}

// ─── Template Utilities ─────────────────────────────────────────────────

/** Get all available templates */
export function getAllTemplates(): FieldbookTemplateConfig[] {
  return TEMPLATES;
}

/** Get templates for a specific survey type */
export function getTemplatesForType(type: FieldbookType): FieldbookTemplateConfig[] {
  return TEMPLATES.filter((t) => t.surveyType === type);
}

/** Get a specific template by ID */
export function getTemplateById(id: string): FieldbookTemplateConfig | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Apply template defaults to a field book configuration */
export function applyTemplateDefaults(
  template: FieldbookTemplateConfig
): Record<string, string | number | boolean> {
  return { ...template.defaults };
}
