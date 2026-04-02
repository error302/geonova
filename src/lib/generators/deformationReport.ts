import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';

export async function generateDeformationReport(
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
    throw new Error('No deformation monitoring data found.');
  }

  const epochData = entries
    .map((e) => ({
      point: e.station || `P${e.row_index}`,
      easting: parseFloat(String(e.raw_data?.easting || e.raw_data?.e || 0)),
      northing: parseFloat(String(e.raw_data?.northing || e.raw_data?.n || 0)),
      elevation: parseFloat(String(e.raw_data?.elevation || e.raw_data?.rl || e.raw_data?.z || 0)),
      epoch: String(e.raw_data?.epoch || 'current'),
    }))
    .filter((p) => p.easting !== 0);

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
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
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
