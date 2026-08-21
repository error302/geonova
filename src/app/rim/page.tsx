'use client';

import {
  MapPin,
  Plus,
  ChevronRight,
  ChevronLeft,
  Loader2,
  LayoutTemplate,
  Map,
  Gem,
  FolderOpen,
  Search,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { statusStyles, statusLabels } from './types';
import { useRimState } from './useRimState';
import { Toast, EmptyState, ConfirmDialog } from './components';
import { SectionEditor } from './SectionEditor';
import { TemplatesModal } from './TemplatesModal';

// ────────────────────────────────────────────────────────────────
// Main Page Component
// ────────────────────────────────────────────────────────────────

export default function RimEditorPage() {
  const rim = useRimState();
  const {
    authChecked,
    toast,
    setToast,
    selectedProjectId,
    handleOpenTemplates,
    handleCreateSection,
    projectsLoading,
    projectSearch,
    setProjectSearch,
    filteredProjects,
    handleSelectProject,
    projects,
    sections,
    sectionsLoading,
    activeSection,
    handleSelectSection,
    handleDeleteSection,
    confirmDialog,
    setConfirmDialog,
  } = rim;

  // ── Loading state ──
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row flex-wrap sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">RIM Editor</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Resurvey and Index Map — Kenya Cadastral Document System
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Survey Act Cap 299 · Survey Regulations L.N. 168/1994
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProjectId && (
            <button onClick={handleOpenTemplates} className="btn btn-secondary">
              <LayoutTemplate className="w-4 h-4" />
              <span className="hidden sm:inline">From Template</span>
            </button>
          )}
          {selectedProjectId && (
            <button onClick={handleCreateSection} className="btn btn-primary">
              <Plus className="w-4 h-4" />
              New Section
            </button>
          )}
        </div>
      </div>

      {/* Step 1: Project Selection */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
            <FolderOpen className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Select Project</h2>
          {selectedProjectId && (
            <button
              onClick={() => handleSelectProject('')}
              className="ml-auto flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Change
            </button>
          )}
        </div>

        {projectsLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading projects...
          </div>
        ) : !selectedProjectId ? (
          <>
            {projects.length > 5 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  aria-label="Search projects" placeholder="Search projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="input pl-9"
                />
              </div>
            )}
            {filteredProjects.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  {projectSearch ? 'No matching projects found.' : 'No projects yet. Create one first.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[var(--bg-tertiary)] transition-all text-left group"
                  >
                    <MapPin className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">{project.name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {[
                          project.survey_type,
                          project.location,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Survey Project'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--accent-subtle)]">
            <MapPin className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {projects.find((p) => p.id === selectedProjectId)?.name || 'Selected Project'}
            </span>
          </div>
        )}
      </div>

      {/* Step 2: Sections List */}
      {selectedProjectId && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
                <Map className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">RIM Sections</h2>
              <span className="text-xs text-[var(--text-muted)]">({sections.length})</span>
            </div>
          </div>

          {sectionsLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading sections...
            </div>
          ) : sections.length === 0 ? (
            <EmptyState
              icon={<Gem className="w-6 h-6" />}
              title="No RIM sections yet"
              description="Create a new blank section or start from one of 10 Kenya-specific templates to get started quickly."
              action={
                <div className="flex items-center gap-2">
                  <button onClick={handleOpenTemplates} className="btn btn-secondary">
                    <LayoutTemplate className="w-4 h-4" />
                    From Template
                  </button>
                  <button onClick={handleCreateSection} className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    Blank Section
                  </button>
                </div>
              }
            />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {sections.map((section) => {
                const isActive = activeSection?.id === section.id;
                return (
                  <div
                    key={section.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${
                      isActive
                        ? 'border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[var(--accent-subtle)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                    onClick={() => !isActive && handleSelectSection(section)}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isActive ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                      }`}
                    >
                      <Gem className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {section.section_name || 'Untitled Section'}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            statusStyles[section.status] || statusStyles.draft
                          }`}
                        >
                          {statusLabels[section.status] || section.status}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                        {[
                          section.map_sheet_number && `MS ${section.map_sheet_number}`,
                          section.scale && `Scale ${section.scale}`,
                          section.registry && `Reg: ${section.registry}`,
                          `${section.parcel_count ?? 0} parcels`,
                          `${section.beacon_count ?? 0} beacons`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isActive ? (
                        <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSection(section);
                            }}
                            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete section"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Section Editor */}
      <SectionEditor rim={rim} />

      {/* Template Selection Modal */}
      <TemplatesModal rim={rim} />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
