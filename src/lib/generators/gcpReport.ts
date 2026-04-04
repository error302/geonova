import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';

export async function generateGcpReport(
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
    throw new Error('No GCP data found. Add fieldbook entries first.');
  }

  const gcpData = entries
    .map((e: any) => ({
      name: e.station || `GCP${e.row_index}`,
      easting: parseFloat(String(e.raw_data?.easting || e.raw_data?.e || 0)),
      northing: parseFloat(String(e.raw_data?.northing || e.raw_data?.n || 0)),
      elevation: parseFloat(String(e.raw_data?.elevation || e.raw_data?.rl || e.raw_data?.z || 0)),
      accuracy: parseFloat(String(e.raw_data?.accuracy || e.raw_data?.rms || 0)),
    }))
    .filter((g: any) => g.easting !== 0 && g.northing !== 0);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GROUND CONTROL POINT (GCP) ACCURACY REPORT', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 14, 25);
  doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 196, 25, { align: 'right' });

  const tableData = gcpData.map((g: any) => [
    g.name,
    g.easting.toFixed(3),
    g.northing.toFixed(3),
    g.elevation.toFixed(3),
    g.accuracy > 0 ? g.accuracy.toFixed(3) : '—',
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['GCP Name', 'Easting (m)', 'Northing (m)', 'Elevation (m)', 'RMS Error (m)']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const avgAccuracy = gcpData.reduce((s: any, g: any) => s + g.accuracy, 0) / gcpData.length;
  const maxAccuracy = Math.max(...gcpData.map((g: any) => g.accuracy));

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 14, finalY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total GCPs: ${gcpData.length}`, 14, finalY + 18);
  doc.text(`Average RMS Error: ${avgAccuracy.toFixed(3)} m`, 14, finalY + 25);
  doc.text(`Maximum RMS Error: ${maxAccuracy.toFixed(3)} m`, 14, finalY + 32);

  return Buffer.from(doc.output('arraybuffer'));
}

