import ExcelJS from 'exceljs';
import db from '@/lib/db';

export async function generateFieldBookExcel(
  projectId: string
): Promise<Buffer> {

  const projectRes = await db.query(
    'SELECT name, survey_type, ref_no FROM projects WHERE id = $1',
    [projectId]
  );
  const project = projectRes.rows[0] as { name: string; survey_type: string | null; ref_no: string | null } | undefined;

  const entriesRes = await db.query(
    'SELECT row_index, raw_data FROM project_fieldbook_entries WHERE project_id = $1 ORDER BY row_index ASC',
    [projectId]
  );
  const entries = entriesRes.rows;

  const rows = (entries ?? []).map((e: { row_index: number; raw_data: Record<string, unknown> }) => e.raw_data)

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

  rows.forEach((row: Record<string, unknown>, idx: number) => {
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

