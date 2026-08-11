import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '@/lib/db';

export async function generateLongitudinalSection(
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
    throw new Error('No levelling data found. Add fieldbook entries first.');
  }

  const levellingData = entries
    .map((e: { row_index: number; station: string; raw_data: Record<string, unknown> }) => ({
      station: e.station || `P${e.row_index}`,
      chainage: parseFloat(String(e.raw_data?.chainage ?? e.raw_data?.distance ?? e.row_index * 10)),
      rl: parseFloat(String(e.raw_data?.rl ?? e.raw_data?.elevation ?? 0)),
      remark: String(e.raw_data?.remark ?? e.raw_data?.description ?? ''),
    }))
    .filter((d) => !isNaN(d.rl))
    .sort((a, b) => a.chainage - b.chainage)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LONGITUDINAL SECTION REPORT', 148, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 14, 25);
  doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 250, 25, { align: 'right' });

  const tableData = levellingData.map((d) => [
    d.station,
    d.chainage.toFixed(2),
    d.rl.toFixed(3),
    d.remark,
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Station', 'Chainage (m)', 'Reduced Level (m)', 'Remark']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 'auto' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, finalY + 10);

  const minRL = Math.min(...levellingData.map((d) => d.rl))
  const maxRL = Math.max(...levellingData.map((d) => d.rl))
  const totalChainage = levellingData[levellingData.length - 1].chainage - levellingData[0].chainage;

  doc.setFont('helvetica', 'normal');
  doc.text(`Start Chainage: ${levellingData[0].chainage.toFixed(2)} m`, 14, finalY + 18);
  doc.text(`End Chainage: ${levellingData[levellingData.length - 1].chainage.toFixed(2)} m`, 14, finalY + 25);
  doc.text(`Total Length: ${totalChainage.toFixed(2)} m`, 14, finalY + 32);
  doc.text(`Min RL: ${minRL.toFixed(3)} m`, 100, finalY + 18);
  doc.text(`Max RL: ${maxRL.toFixed(3)} m`, 100, finalY + 25);
  doc.text(`Total Fall: ${(maxRL - minRL).toFixed(3)} m`, 100, finalY + 32);

  return Buffer.from(doc.output('arraybuffer'));
}

