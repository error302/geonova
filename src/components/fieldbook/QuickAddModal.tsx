'use client';

/**
 * QuickAddModal — Legacy quick-add for traverse observations (polar only).
 *
 * Now properly integrated with BeaconPhotoCapture for evidence-chain
 * photo capture with EXIF GPS extraction. Photos are embedded into
 * the observation's remarks field for legal traceability.
 *
 * For multi-survey-type entry, use UniversalMobileObservationForm instead.
 */

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { BeaconPhotoCapture, type CapturedBeaconPhoto, revokeCapturedPhotos } from './BeaconPhotoCapture';
import { VoiceDictationButton } from '@/components/shared/VoiceDictationButton';

export interface QuickAddObservation {
  station_from: string;
  station_to: string;
  horizontal_angle: number;
  vertical_angle: number;
  slope_distance: number;
  target_height: number;
  instrument_height: number;
  remarks: string;
}

interface QuickAddModalProps {
  onAdd: (obs: QuickAddObservation, photos: CapturedBeaconPhoto[]) => void;
  onClose: () => void;
}

export function QuickAddModal({ onAdd, onClose }: QuickAddModalProps) {
  const [form, setForm] = useState({
    station_from: '',
    station_to: '',
    horizontal_angle: '',
    vertical_angle: '90',
    slope_distance: '',
    target_height: '1.500',
    instrument_height: '1.500',
    remarks: '',
  });

  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<CapturedBeaconPhoto[]>([]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { revokeCapturedPhotos(photos); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Build a remarks string that includes photo GPS evidence markers. */
  const buildRemarks = (): string => {
    let remarks = form.remarks;
    const gpsPhotos = photos.filter(p => p.exif);
    if (gpsPhotos.length > 0) {
      const markers = gpsPhotos.map((p, i) => {
        const caption = p.caption ? ` "${p.caption}"` : '';
        return `[photo${i + 1} @${p.exif?.latitude.toFixed(6) ?? ''},${p.exif?.longitude.toFixed(6) ?? ''}${caption}]`;
      });
      remarks = remarks ? `${remarks} ${markers.join(' ')}` : markers.join(' ');
    }
    return remarks;
  };

  const handleSubmit = async () => {
    if (!form.station_from || !form.station_to || !form.slope_distance) return;

    setSaving(true);

    try {
      await onAdd(
        {
          station_from: form.station_from.toUpperCase(),
          station_to: form.station_to.toUpperCase(),
          horizontal_angle: parseFloat(form.horizontal_angle) || 0,
          vertical_angle: parseFloat(form.vertical_angle) || 90,
          slope_distance: parseFloat(form.slope_distance) || 0,
          target_height: parseFloat(form.target_height) || 1.5,
          instrument_height: parseFloat(form.instrument_height) || 1.5,
          remarks: buildRemarks(),
        },
        photos,
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full p-4 text-xl border rounded-lg touch-manipulation';
  const labelClass = 'block text-sm font-medium mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="w-full bg-white rounded-t-2xl max-h-[95vh] overflow-auto flex flex-col">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Observation</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label htmlFor="qa-from-station" className={labelClass}>From Station</label>
            <input
              id="qa-from-station"
              type="text"
              value={form.station_from}
              onChange={(e) => setForm({ ...form, station_from: e.target.value.toUpperCase() })}
              className={inputClass}
              placeholder="A"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into the modal on open (WCAG 2.4.3)
              autoFocus
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="qa-to-station" className={labelClass}>To Station</label>
            <input
              id="qa-to-station"
              type="text"
              value={form.station_to}
              onChange={(e) => setForm({ ...form, station_to: e.target.value.toUpperCase() })}
              className={inputClass}
              placeholder="1"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="qa-horiz-angle" className={labelClass}>Horiz. Angle (°)</label>
              <input
                id="qa-horiz-angle"
                type="number"
                step="0.0001"
                value={form.horizontal_angle}
                onChange={(e) => setForm({ ...form, horizontal_angle: e.target.value })}
                className={inputClass}
                placeholder="45.1234"
              />
            </div>
            <div>
              <label htmlFor="qa-vert-angle" className={labelClass}>Vert. Angle (°)</label>
              <input
                id="qa-vert-angle"
                type="number"
                step="0.0001"
                value={form.vertical_angle}
                onChange={(e) => setForm({ ...form, vertical_angle: e.target.value })}
                className={inputClass}
                placeholder="90.0000"
              />
            </div>
          </div>

          <div>
            <label htmlFor="qa-slope-distance" className={labelClass}>Slope Distance (m)</label>
            <input
              id="qa-slope-distance"
              type="number"
              step="0.001"
              value={form.slope_distance}
              onChange={(e) => setForm({ ...form, slope_distance: e.target.value })}
              className={inputClass}
              placeholder="125.456"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="qa-hi" className={labelClass}>HI (m)</label>
              <input id="qa-hi"
                type="number"
                step="0.001"
                value={form.instrument_height}
                onChange={(e) => setForm({ ...form, instrument_height: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="qa-ht" className={labelClass}>HT (m)</label>
              <input id="qa-ht"
                type="number"
                step="0.001"
                value={form.target_height}
                onChange={(e) => setForm({ ...form, target_height: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="qa-remarks" className={labelClass}>Remarks</label>
            <div className="flex items-start gap-2">
              <input
                id="qa-remarks"
                type="text"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className={inputClass + ' flex-1 min-w-0'}
                placeholder="Concrete beacon, flush"
              />
              <VoiceDictationButton
                value={form.remarks}
                onChange={(v) => setForm({ ...form, remarks: v })}
              />
            </div>
          </div>

          {/* ─── Beacon photo capture with EXIF GPS ─── */}
          <div className="pt-2 border-t">
            <div className={labelClass}>Beacon / Site Photos</div>
            <BeaconPhotoCapture photos={photos} onChange={setPhotos} maxPhotos={4} />
          </div>
        </div>

        <div className="sticky bottom-0 p-4 bg-white border-t">
          <button
            onClick={handleSubmit}
            disabled={!form.station_from || !form.station_to || !form.slope_distance || saving}
            className={[
              'w-full py-4 rounded-lg font-semibold text-lg transition-colors',
              form.station_from && form.station_to && form.slope_distance && !saving
                ? 'bg-blue-600 text-white active:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            {saving ? (
              'Saving...'
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                Save Observation
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
