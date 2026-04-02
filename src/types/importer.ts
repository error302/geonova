export type SupportedFormat =
  | 'csv'
  | 'dxf'
  | 'gsi'
  | 'jobxml'
  | 'trimble-rw5'
  | 'geojson'
  | 'kml'
  | 'xyz'
  | 'unknown';

export interface ParsedPoint {
  point_no?: string;
  easting?: number;
  northing?: number;
  rl?: number;
  bearing?: number;
  distance?: number;
  code?: string;
  remark?: string;
  raw?: Record<string, unknown>;
  raw_data?: Record<string, unknown>;
}

export interface ParseResult {
  format: SupportedFormat;
  points: ParsedPoint[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export interface ImportSession {
  id: string;
  project_id: string;
  file_name: string;
  format: SupportedFormat;
  row_count: number;
  status: 'pending' | 'mapped' | 'committed' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: keyof ParsedPoint;
}
