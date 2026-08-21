'use client';

import {
  LayoutTemplate,
  X,
  Search,
  Loader2,
  Plus,
} from 'lucide-react';
import { categoryColors } from './types';
import { getCategoryIcon } from './components';
import type { RimState } from './useRimState';

// ────────────────────────────────────────────────────────────────
// TemplatesModal — the RIM Templates picker modal
// ────────────────────────────────────────────────────────────────

export function TemplatesModal({ rim }: { rim: RimState }) {
  const {
    showTemplates,
    setShowTemplates,
    templateSearch,
    setTemplateSearch,
    templates,
    templatesLoading,
    filteredTemplates,
    handleCreateFromTemplate,
    handleCreateSection,
  } = rim;

  if (!showTemplates) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">RIM Templates</h2>
            <span className="text-xs text-[var(--text-muted)]">
              ({templates.length} Kenya-specific templates)
            </span>
          </div>
          <button
            onClick={() => setShowTemplates(false)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              aria-label="Search templates" placeholder="Search templates by name, category, or tag..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {templatesLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-[var(--text-muted)]">No matching templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer"
                  onClick={() => handleCreateFromTemplate(template.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg border shrink-0 ${
                        categoryColors[template.category] || categoryColors.special
                      }`}
                    >
                      {getCategoryIcon(template.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {template.name}
                        </h4>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                        <span className="capitalize">{template.category}</span>
                        <span>{template.parcelCount} parcels</span>
                        <span>{template.beaconCount} beacons</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                        {template.tags.length > 4 && (
                          <span className="text-[9px] text-[var(--text-muted)]">
                            +{template.tags.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border-color)] shrink-0">
          <button
            onClick={() => {
              setShowTemplates(false);
              handleCreateSection();
            }}
            className="btn btn-secondary text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Blank Instead
          </button>
          <button
            onClick={() => setShowTemplates(false)}
            className="btn btn-secondary text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
