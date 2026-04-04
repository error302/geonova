import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/client';

export async function generateFieldBookExcel(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {

  const { data: project } = await supabase
    .from('projects')
    .select('name, survey_type, ref_no')
    .eq('id', projectId)
    .single();

  const { data: entries } = await supabase
    .from('project_fieldbook_entries')
    .select('row_index, raw_data')
    .eq('project_id', projectId)
    .order('row_index', { ascending: true });

  const rows = (entries ?? []).map((e: any) => e.raw_data as Record<string, unknown>);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metardu';
  wb.created = new Date();

  const ws = wb.addWorksheet('Field Book', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `FIELD BOOK — ${project?.name ?? 'Project'} — ${project?.survey_type?.toUpperCase() ?? ''}`;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF1E5064' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = `Ref: ${project?.ref_no ?? '—'}`;
  ws.mergeCells('F2:J2');
  ws.getCell('F2').value = `Generated: ${new Date().toLocaleDateString('en-KE')}`;
  ws.getCell('F2').alignment = { horizontal: 'right' };

  const allKeys = rows.length > 0
    ? Object.keys(rows[0]).filter((k) => !k.startsWith('_'))
    : ['station', 'bs', 'is', 'fs', 'rl', 'remark'];

  const headerRow = ws.addRow(allKeys.map((k) => k.replace(/_/g, ' ').toUpperCase()));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5064' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  ws.getRow(3).height = 20;

  rows.forEach((row: any, idx: any) => {
    const dataRow = ws.addRow(allKeys.map((k) => row[k] ?? ''));
    if (idx % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F5F8' } };
      });
    }
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'hair' }, bottom: { style: 'hair' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
  });

  ws.columns.forEach((col) => {
    col.width = 16;
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

