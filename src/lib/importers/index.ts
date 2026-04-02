import './parsers/csv';
import './parsers/gsi';
import './parsers/jobxml';
import './parsers/trimbleRw5';
import './parsers/dxf';
import './parsers/traverse-csv';

export { detectFormat, getParser, getAllParsers } from './registry';
export type { Parser } from './registry';
