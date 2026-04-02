import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/client';

export async function generateCoordinateSchedule(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {

  const { data: project } = await supabase
    .from('projects')
    .select('name, survey_type, ref_no')
    .eq('id', projectId)
    .single();

  const { data: beacons } = await supabase
    .from('project_beacons')
    .select('*')
    .eq('project_id', projectId)
    .order('beacon_no', { ascending: true });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metardu';

  const ws = wb.addWorksheet('Coordinate Schedule', {
    pageSetup: { paperSize: 9, orientation: 'portrait' },
  });

  ws.mergeCells('A1:G1');
  const title = ws.getCell('A1');
  title.value = `COORDINATE SCHEDULE — ${project?.name ?? 'Project'}`;
  title.font = { bold: true, size: 12, color: { argb: 'FF1E5064' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = `Survey Type: ${project?.survey_type ?? '—'} | Ref: ${project?.ref_no ?? '—'}`;
  ws.mergeCells('E2:G2');
  ws.getCell('E2').value = `Date: ${new Date().toLocaleDateString('en-KE')}`;
  ws.getCell('E2').alignment = { horizontal: 'right' };

  const headers = ['Beacon No.', 'Easting (m)', 'Northing (m)', 'RL (m)', 'Description', 'Monument Type', 'Remark'];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5064' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
  ws.getRow(3).height = 18;

  (beacons ?? []).forEach((beacon, idx) => {
    const row = ws.addRow([
      beacon.beacon_no,
      beacon.easting,
      beacon.northing,
      beacon.rl ?? '',
      beacon.description ?? '',
      beacon.monument_type ?? '',
      '',
    ]);

    if (idx % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F5F8' } };
      });
    }

    [2, 3, 4].forEach((colIdx) => {
      const cell = row.getCell(colIdx);
      cell.numFmt = '#,##0.000';
    });
  });

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 24;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 20;

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
