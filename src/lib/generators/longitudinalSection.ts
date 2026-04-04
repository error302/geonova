import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';

export async function generateLongitudinalSection(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single();

  if (!project) throw new Error('Project not found');

  const { data: entries } = await supabase
    .from('project_fieldbook_entries')
    .select('row_index, station, raw_data')
    .eq('project_id', projectId)
    .order('row_index', { ascending: true });

  if (!entries || entries.length === 0) {
    throw new Error('No levelling data found. Add fieldbook entries first.');
  }

  const levellingData = entries
    .map((e: any) => ({
      station: e.station || `P${e.row_index}`,
      chainage: parseFloat(String(e.raw_data?.chainage || e.raw_data?.distance || e.row_index * 10)),
      rl: parseFloat(String(e.raw_data?.rl || e.raw_data?.elevation || 0)),
      remark: e.raw_data?.remark || e.raw_data?.description || '',
    }))
    .filter((d: any) => !isNaN(d.rl))
    .sort((a: any, b: any) => a.chainage - b.chainage);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LONGITUDINAL SECTION REPORT', 148, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 14, 25);
  doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 250, 25, { align: 'right' });

  const tableData = levellingData.map((d: any) => [
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
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
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

  const minRL = Math.min(...levellingData.map((d: any) => d.rl));
  const maxRL = Math.max(...levellingData.map((d: any) => d.rl));
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

