'use client';

import {
  ChevronLeft,
  Loader2,
  Save,
  X,
  Navigation,
  FileDown,
  Trash2,
  Plus,
  ArrowUpRight,
  Map,
} from 'lucide-react';
import { beaconTypes, surveyStatuses } from './types';
import type { RimState } from './useRimState';

// ────────────────────────────────────────────────────────────────
// SectionEditor — the active RIM section editor (metadata form +
// parcels table + beacons table + regulatory reference card)
// ────────────────────────────────────────────────────────────────

export function SectionEditor({ rim }: { rim: RimState }) {
  const {
    activeSection,
    setActiveSection,
    setParcels,
    setBeacons,
    sectionForm,
    setSectionForm,
    sectionSaving,
    handleUpdateSection,
    handleGeneratePdf,
    pdfGenerating,
    handleDeleteSection,
    parcels,
    showAddParcel,
    setShowAddParcel,
    newParcel,
    setNewParcel,
    handleAddParcel,
    beacons,
    showAddBeacon,
    setShowAddBeacon,
    newBeacon,
    setNewBeacon,
    handleAddBeacon,
  } = rim;

  if (!activeSection) return null;

  return (
    <div className="space-y-4">
      {/* Editor Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveSection(null);
              setParcels([]);
              setBeacons([]);
            }}
            className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {activeSection.section_name || 'Untitled Section'}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Editing RIM section details, parcels, and beacons
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePdf}
            disabled={pdfGenerating}
            className="btn btn-secondary"
          >
            {pdfGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {pdfGenerating ? 'Generating...' : 'Export PDF'}
          </button>
          <button
            onClick={handleUpdateSection}
            disabled={sectionSaving}
            className="btn btn-primary"
          >
            {sectionSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {sectionSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => handleDeleteSection(activeSection)}
            className="p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section Metadata */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
            <Navigation className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Section Metadata</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Section Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="section-name">
              Section Name
            </label>
            <input id="section-name"
              type="text"
              className="input"
              placeholder="e.g. LR 123/456 Section II"
              value={sectionForm.section_name || ''}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, section_name: e.target.value }))}
            />
          </div>

          {/* Registry */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="registry">
              Registry
            </label>
            <input id="registry"
              type="text"
              className="input"
              placeholder="e.g. Machakos"
              value={sectionForm.registry || ''}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, registry: e.target.value }))}
            />
          </div>

          {/* District */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="district-county">
              District / County
            </label>
            <input id="district-county"
              type="text"
              className="input"
              placeholder="e.g. Machakos County"
              value={sectionForm.district || ''}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, district: e.target.value }))}
            />
          </div>

          {/* Map Sheet Number */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="map-sheet-number">
              Map Sheet Number
            </label>
            <input id="map-sheet-number"
              type="text"
              className="input"
              placeholder="e.g. MS 1234"
              value={sectionForm.map_sheet_number || ''}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, map_sheet_number: e.target.value }))}
            />
          </div>

          {/* Scale */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="scale">
              Scale
            </label>
            <select id="scale"
              className="input"
              value={sectionForm.scale || '1:2500'}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, scale: e.target.value }))}
            >
              {['1:500', '1:1000', '1:1250', '1:2500', '1:5000', '1:10000', '1:25000', '1:50000'].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Datum */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="datum">
              Datum
            </label>
            <select id="datum"
              className="input"
              value={sectionForm.datum || 'Arc 1960'}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, datum: e.target.value }))}
            >
              {['Arc 1960', 'WGS 84', 'Clarke 1880 (RGS)', 'Clarke 1880 (Modified)', 'Cape Datum', 'Adindan'].map(
                (d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Projection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="projection">
              Projection
            </label>
            <select id="projection"
              className="input"
              value={sectionForm.projection || 'UTM Zone 37S'}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, projection: e.target.value }))}
            >
              {[
                'UTM Zone 36S',
                'UTM Zone 36N',
                'UTM Zone 37S',
                'UTM Zone 37N',
                'UTM Zone 38S',
                'UTM Zone 38N',
                'UTM Zone 35S',
                'UTM Zone 35N',
                'Kenya Modified UTM',
                'Local Grid',
              ].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Total Area */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="total-area-ha">
              Total Area (Ha)
            </label>
            <input id="total-area-ha"
              type="number"
              step="0.0001"
              className="input"
              placeholder="0.0000"
              value={sectionForm.total_area || ''}
              onChange={(e) =>
                setSectionForm((prev) => ({
                  ...prev,
                  total_area: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="status">
              Status
            </label>
            <select id="status"
              className="input"
              value={sectionForm.status || 'draft'}
              onChange={(e) =>
                setSectionForm((prev) => ({
                  ...prev,
                  status: e.target.value as 'draft' | 'review' | 'approved',
                }))
              }
            >
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="approved">Approved</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5" htmlFor="notes">
            Notes
          </label>
          <textarea
             id="notes" className="input min-h-[72px] resize-y"
            placeholder="Additional notes, surveyor remarks, or references..."
            value={sectionForm.notes || ''}
            onChange={(e) => setSectionForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
          />
        </div>
      </div>

      {/* Tabs: Parcels & Beacons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parcels Table */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Map className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Parcels
                <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                  ({parcels.length})
                </span>
              </h3>
            </div>
            <button
              onClick={() => setShowAddParcel(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {/* Add Parcel Form */}
          {showAddParcel && (
            <div className="mb-4 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  New Parcel
                </span>
                <button
                  onClick={() => setShowAddParcel(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="input text-xs"
                  aria-label="Parcel Number" placeholder="e.g. LR 123/456"
                  value={newParcel.parcel_number}
                  onChange={(e) => setNewParcel((prev) => ({ ...prev, parcel_number: e.target.value }))}
                />
                <input
                  type="number"
                  step="0.0001"
                  className="input text-xs"
                  aria-label="Area (Ha)" placeholder="e.g. 0.5"
                  value={newParcel.area}
                  onChange={(e) => setNewParcel((prev) => ({ ...prev, area: e.target.value }))}
                />
                <input
                  type="text"
                  className="input text-xs"
                  aria-label="Land Use" placeholder="e.g. Residential"
                  value={newParcel.land_use}
                  onChange={(e) => setNewParcel((prev) => ({ ...prev, land_use: e.target.value }))}
                />
                <input
                  type="number"
                  className="input text-xs"
                  aria-label="Beacon Count" placeholder="e.g. 4"
                  value={newParcel.beacon_count}
                  onChange={(e) => setNewParcel((prev) => ({ ...prev, beacon_count: e.target.value }))}
                />
              </div>
              <input
                type="text"
                className="input text-xs"
                aria-label="Owner Name" placeholder="e.g. John Doe"
                value={newParcel.owner_name}
                onChange={(e) => setNewParcel((prev) => ({ ...prev, owner_name: e.target.value }))}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAddParcel(false);
                    setNewParcel({ parcel_number: '', area: '', land_use: '', owner_name: '', beacon_count: '' });
                  }}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button onClick={handleAddParcel} className="btn btn-primary text-xs py-1.5 px-3">
                  Add Parcel
                </button>
              </div>
            </div>
          )}

          {/* Parcels List */}
          {parcels.length === 0 && !showAddParcel ? (
            <div className="py-8 text-center">
              <Map className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
              <p className="text-xs text-[var(--text-muted)]">No parcels added yet</p>
              <button
                onClick={() => setShowAddParcel(true)}
                className="mt-2 text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add first parcel
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border-color)]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Parcel No.
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Area (Ha)
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden sm:table-cell">
                      Land Use
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden lg:table-cell">
                      Owner
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parcels.map((parcel) => (
                    <tr
                      key={parcel.id}
                      className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--glass-bg)] transition-colors"
                    >
                      <td className="px-3 py-2 text-xs font-medium text-[var(--text-primary)]">
                        {parcel.parcel_number || '—'}
                        {parcel.is_landmark && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/30">
                            LMK
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] tabular-nums">
                        {parcel.area > 0 ? parcel.area.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] hidden sm:table-cell">
                        {parcel.land_use || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] hidden lg:table-cell truncate max-w-[140px]">
                        {parcel.owner_name || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Beacons Table */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Navigation className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Beacons
                <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                  ({beacons.length})
                </span>
              </h3>
            </div>
            <button
              onClick={() => setShowAddBeacon(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {/* Add Beacon Form */}
          {showAddBeacon && (
            <div className="mb-4 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  New Beacon
                </span>
                <button
                  onClick={() => setShowAddBeacon(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="input text-xs"
                  aria-label="Beacon Number" placeholder="e.g. B1"
                  value={newBeacon.beacon_number}
                  onChange={(e) => setNewBeacon((prev) => ({ ...prev, beacon_number: e.target.value }))}
                />
                <select
                  className="input text-xs"
                  value={newBeacon.type}
                  onChange={(e) => setNewBeacon((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {beaconTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  className="input text-xs"
                  aria-label="Easting" placeholder="e.g. 500000.000"
                  value={newBeacon.easting}
                  onChange={(e) => setNewBeacon((prev) => ({ ...prev, easting: e.target.value }))}
                />
                <input
                  type="number"
                  step="0.001"
                  className="input text-xs"
                  aria-label="Northing" placeholder="e.g. 9900000.000"
                  value={newBeacon.northing}
                  onChange={(e) => setNewBeacon((prev) => ({ ...prev, northing: e.target.value }))}
                />
                <select
                  className="input text-xs"
                  value={newBeacon.survey_status}
                  onChange={(e) => setNewBeacon((prev) => ({ ...prev, survey_status: e.target.value }))}
                >
                  {surveyStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                className="input text-xs"
                aria-label="Description" placeholder="e.g. Corner pillar"
                value={newBeacon.description}
                onChange={(e) => setNewBeacon((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAddBeacon(false);
                    setNewBeacon({
                      beacon_number: '',
                      easting: '',
                      northing: '',
                      description: '',
                      type: 'Pillar',
                      survey_status: 'Original',
                    });
                  }}
                  className="btn btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button onClick={handleAddBeacon} className="btn btn-primary text-xs py-1.5 px-3">
                  Add Beacon
                </button>
              </div>
            </div>
          )}

          {/* Beacons List */}
          {beacons.length === 0 && !showAddBeacon ? (
            <div className="py-8 text-center">
              <Navigation className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
              <p className="text-xs text-[var(--text-muted)]">No beacons added yet</p>
              <button
                onClick={() => setShowAddBeacon(true)}
                className="mt-2 text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add first beacon
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--border-color)]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Beacon
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden sm:table-cell">
                      Type
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      E / N
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden lg:table-cell">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {beacons.map((beacon) => (
                    <tr
                      key={beacon.id}
                      className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--glass-bg)] transition-colors"
                    >
                      <td className="px-3 py-2">
                        <div className="text-xs font-medium text-[var(--text-primary)]">
                          {beacon.beacon_number || '—'}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">
                          {beacon.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] hidden sm:table-cell">
                        {beacon.type}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] tabular-nums">
                        <span className="text-[var(--text-muted)]">E:</span>{' '}
                        {(beacon.easting || 0).toFixed(3)}
                        <br />
                        <span className="text-[var(--text-muted)]">N:</span>{' '}
                        {(beacon.northing || 0).toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-xs hidden lg:table-cell">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            beacon.survey_status === 'Original'
                              ? 'bg-green-500/10 text-green-400'
                              : beacon.survey_status === 'Found'
                              ? 'bg-blue-500/10 text-blue-400'
                              : beacon.survey_status === 'Replaced'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {beacon.survey_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Regulation Reference */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] mt-0.5">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Regulatory Reference</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              RIM documents are prepared under <strong className="text-[var(--text-secondary)]">Survey Act Cap 299</strong>,{' '}
              <strong className="text-[var(--text-secondary)]">Survey Regulations L.N. 168/1994</strong>, and the{' '}
              <strong className="text-[var(--text-secondary)]">Land Registration Act 2012</strong>.
              Section data must be verified against the official cadastral records before submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
