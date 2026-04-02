import { SurveyType } from '@/types/project';
import { FieldBookTemplate } from '@/types/fieldbook';

const TEMPLATES: Record<SurveyType, FieldBookTemplate> = {
  cadastral: {
    surveyType: 'cadastral',
    title: 'Traverse Field Book',
    description: 'Record instrument station, bearing, and distance for each leg.',
    columns: [
      { key: 'station', label: 'Station', type: 'text', fixedColumn: 'station', width: '24', required: true, placeholder: 'A' },
      { key: 'target', label: 'Target', type: 'text', width: '24', placeholder: 'B' },
      { key: 'bearing', label: 'Bearing (°\'")', type: 'bearing', width: '32', required: true, placeholder: '045°30\'20"' },
      { key: 'distance', label: 'Distance (m)', type: 'number', width: '28', required: true, placeholder: '100.000' },
      { key: 'beacon_no', label: 'Beacon No.', type: 'text', width: '24', placeholder: 'BM01' },
      { key: 'monument_type', label: 'Monument', type: 'select', width: '28',
        options: ['PSC Found', 'PSC Set', 'SSC', 'Masonry Nail', 'Indicatory', 'BM', 'None'] },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '40', placeholder: 'Corner peg, flush' },
    ],
  },
  engineering: {
    surveyType: 'engineering',
    title: 'Level Book',
    description: 'Record BS, IS, FS readings. Closure: 10√K mm (RDM 1.1 Table 5.1).',
    columns: [
      { key: 'station', label: 'Station', type: 'text', fixedColumn: 'station', width: '24', required: true, placeholder: 'BM1' },
      { key: 'bs', label: 'BS (m)', type: 'number', fixedColumn: 'bs', width: '24', placeholder: '1.245' },
      { key: 'is', label: 'IS (m)', type: 'number', fixedColumn: 'is', width: '24', placeholder: '' },
      { key: 'fs', label: 'FS (m)', type: 'number', fixedColumn: 'fs', width: '24', placeholder: '2.335' },
      { key: 'rl', label: 'RL (m)', type: 'number', fixedColumn: 'rl', width: '28', placeholder: '100.000' },
      { key: 'instrument_height', label: 'IH (m)', type: 'number', fixedColumn: 'instrument_height', width: '24', placeholder: '' },
      { key: 'chainage', label: 'Chainage (m)', type: 'number', width: '28', placeholder: '0+000' },
      { key: 'area', label: 'Area (m²)', type: 'number', width: '24', placeholder: '' },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '40', placeholder: 'TBM on kerb' },
    ],
  },
  topographic: {
    surveyType: 'topographic',
    title: 'Tacheometry / Radial Field Book',
    description: 'Record point code, bearing, horizontal distance, and reduced level.',
    columns: [
      { key: 'point_no', label: 'Point No.', type: 'text', width: '20', required: true, placeholder: 'P001' },
      { key: 'code', label: 'Code', type: 'text', width: '20', placeholder: 'EP' },
      { key: 'bearing', label: 'Bearing (°\'")', type: 'bearing', width: '32', required: true, placeholder: '023°45\'10"' },
      { key: 'hd', label: 'HD (m)', type: 'number', width: '24', required: true, placeholder: '25.340' },
      { key: 'va', label: 'VA (°\'")', type: 'bearing', width: '28', placeholder: '90°00\'00"' },
      { key: 'rl', label: 'RL (m)', type: 'number', fixedColumn: 'rl', width: '28', placeholder: '' },
      { key: 'area', label: 'Area (m²)', type: 'number', width: '24', placeholder: '' },
      { key: 'station', label: 'Inst. Station', type: 'text', fixedColumn: 'station', width: '24', placeholder: 'IS1' },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '40', placeholder: 'Edge path' },
    ],
  },
  geodetic: {
    surveyType: 'geodetic',
    title: 'GNSS Baseline / Control Field Book',
    description: 'Record baseline sessions, antenna heights, and occupation times.',
    columns: [
      { key: 'station', label: 'Station', type: 'text', fixedColumn: 'station', width: '24', required: true, placeholder: 'CP01' },
      { key: 'session_id', label: 'Session ID', type: 'text', width: '24', required: true, placeholder: 'S01' },
      { key: 'antenna_height', label: 'Ant. Ht (m)', type: 'number', fixedColumn: 'instrument_height', width: '24', placeholder: '1.524' },
      { key: 'start_time', label: 'Start (HH:MM)', type: 'text', width: '24', placeholder: '08:00' },
      { key: 'end_time', label: 'End (HH:MM)', type: 'text', width: '24', placeholder: '10:00' },
      { key: 'receiver', label: 'Receiver S/N', type: 'text', width: '28', placeholder: 'TRM123' },
      { key: 'pdop', label: 'PDOP', type: 'number', width: '20', placeholder: '1.8' },
      { key: 'satellites', label: 'Sats', type: 'number', width: '16', placeholder: '8' },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '40', placeholder: '' },
    ],
  },
  mining: {
    surveyType: 'mining',
    title: 'Mining Survey Field Book',
    description: 'Record levelling observations and stockpile identifiers.',
    columns: [
      { key: 'station', label: 'Station', type: 'text', fixedColumn: 'station', width: '24', required: true, placeholder: 'BM1' },
      { key: 'bs', label: 'BS (m)', type: 'number', fixedColumn: 'bs', width: '24', placeholder: '1.245' },
      { key: 'is', label: 'IS (m)', type: 'number', fixedColumn: 'is', width: '24', placeholder: '' },
      { key: 'fs', label: 'FS (m)', type: 'number', fixedColumn: 'fs', width: '24', placeholder: '' },
      { key: 'rl', label: 'RL (m)', type: 'number', fixedColumn: 'rl', width: '28', placeholder: '' },
      { key: 'chainage', label: 'Chainage (m)', type: 'number', width: '24', placeholder: '' },
      { key: 'area', label: 'Area (m²)', type: 'number', width: '20', placeholder: '' },
      { key: 'offset', label: 'Offset (m)', type: 'number', width: '20', placeholder: '' },
      { key: 'stockpile_id', label: 'Stockpile ID', type: 'text', width: '24', placeholder: 'SP-A' },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '36', placeholder: '' },
    ],
  },
  hydrographic: {
    surveyType: 'hydrographic',
    title: 'Hydrographic Sounding Book',
    description: 'Record timestamped soundings and tide gauge readings.',
    columns: [
      { key: 'time', label: 'Time (HH:MM:SS)', type: 'text', width: '28', required: true, placeholder: '09:15:32' },
      { key: 'sounding', label: 'Sounding (m)', type: 'number', width: '24', required: true, placeholder: '3.452' },
      { key: 'easting', label: 'Easting (m)', type: 'number', width: '28', placeholder: '256432.5' },
      { key: 'northing', label: 'Northing (m)', type: 'number', width: '28', placeholder: '9876543.2' },
      { key: 'tide_reading', label: 'Tide (m)', type: 'number', width: '24', placeholder: '0.342' },
      { key: 'corrected_depth', label: 'Corr. Depth (m)', type: 'number', fixedColumn: 'rl', width: '28', placeholder: '' },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '36', placeholder: '' },
    ],
  },
  drone: {
    surveyType: 'drone',
    title: 'GCP & Flight Log',
    description: 'Record ground control points. Minimum 5 GCPs recommended.',
    columns: [
      { key: 'gcp_no', label: 'GCP No.', type: 'text', fixedColumn: 'station', width: '20', required: true, placeholder: 'GCP01' },
      { key: 'easting', label: 'Easting (m)', type: 'number', width: '28', required: true, placeholder: '256432.500' },
      { key: 'northing', label: 'Northing (m)', type: 'number', width: '28', required: true, placeholder: '9876543.200' },
      { key: 'rl', label: 'RL (m)', type: 'number', fixedColumn: 'rl', width: '24', required: true, placeholder: '1234.567' },
      { key: 'code', label: 'Code', type: 'select', width: '24', options: ['Control', 'Check', 'Target'] },
      { key: 'photo_id', label: 'Photo ID', type: 'text', width: '24', placeholder: 'IMG_0042' },
      { key: 'accuracy', label: 'Accuracy (m)', type: 'number', width: '24', placeholder: '0.015' },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '36', placeholder: '' },
    ],
  },
  deformation: {
    surveyType: 'deformation',
    title: 'Monitoring Epoch Book',
    description: 'Record each monitoring epoch. Reference epoch (E0) is set in project setup.',
    columns: [
      { key: 'epoch', label: 'Epoch', type: 'text', width: '20', required: true, placeholder: 'E1' },
      { key: 'obs_date', label: 'Date', type: 'date', width: '28', required: true },
      { key: 'station', label: 'Station', type: 'text', fixedColumn: 'station', width: '24', required: true, placeholder: 'M01' },
      { key: 'reading', label: 'Reading (m)', type: 'number', fixedColumn: 'bs', width: '24', required: true, placeholder: '100.000' },
      { key: 'rl', label: 'RL (m)', type: 'number', fixedColumn: 'rl', width: '28', placeholder: '' },
      { key: 'displacement', label: 'Δ (mm)', type: 'number', width: '20', placeholder: '' },
      { key: 'remark', label: 'Remark', type: 'text', fixedColumn: 'remark', width: '40', placeholder: '' },
    ],
  },
};

export function getFieldBookTemplate(surveyType: SurveyType): FieldBookTemplate {
  return TEMPLATES[surveyType];
}

export { TEMPLATES as FIELD_BOOK_TEMPLATES };