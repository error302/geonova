import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '@/lib/db';

export async function generateDeformationReport(
  projectId: string
): Promise<Buffer> {
  const projectRes = await db.query('SELECT name FROM projects WHERE id = $1', [projectId]);
  const project = projectRes.rows[0];
  if (!project) throw new Error('Project not found');

  const entriesRes = await db.query<{ row_index: number; station: string; raw_data: Record<string, unknown> }>(
    'SELECT row_index, station, raw_data FROM project_fieldbook_entries WHERE project_id = $1 ORDER BY row_index ASC',
    [projectId]
  );
  const entries = entriesRes.rows;

  if (!entries || entries.length === 0) {
    throw new Error('No deformation monitoring data found.');
  }

  const epochData = entries
    .map((e: { row_index: number; station: string; raw_data: Record<string, unknown> }) => ({
      point: e.station || `P${e.row_index}`,
      easting: parseFloat(String(e.raw_data?.easting ?? e.raw_data?.e ?? 0)),
      northing: parseFloat(String(e.raw_data?.northing ?? e.raw_data?.n ?? 0)),
      elevation: parseFloat(String(e.raw_data?.elevation ?? e.raw_data?.rl ?? e.raw_data?.z ?? 0)),
      epoch: String(e.raw_data?.epoch ?? 'current'),
    }))
    .filter((p) => p.easting !== 0)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DEFORMATION / MONITORING REPORT', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 14, 25);
  doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 196, 25, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('MONITORING POINTS', 14, 35);

  const tableData = epochData.map((p) => [
    p.point,
    p.epoch,
    p.easting.toFixed(3),
    p.northing.toFixed(3),
    p.elevation.toFixed(3),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Point', 'Epoch', 'Easting (m)', 'Northing (m)', 'Elevation (m)']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INTERPRETATION NOTES', 14, finalY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text('This report shows point positions at different epochs for deformation analysis.', 14, finalY + 18);
  doc.text('Compare epochs to identify displacement vectors and rates of change.', 14, finalY + 25);

  return Buffer.from(doc.output('arraybuffer'));
}

