export type FieldBookColumnType =
  | 'text'
  | 'number'
  | 'bearing'
  | 'date'
  | 'select';

export interface FieldBookColumn {
  key: string;
  label: string;
  type: FieldBookColumnType;
  width?: string;
  required?: boolean;
  options?: string[];
  fixedColumn?: 'station' | 'bs' | 'is' | 'fs' | 'rl' | 'instrument_height' | 'remark';
  placeholder?: string;
}

export type FieldBookRow = Record<string, string | number | null>;

export interface FieldBookTemplate {
  surveyType: string;
  title: string;
  description: string;
  columns: FieldBookColumn[];
}