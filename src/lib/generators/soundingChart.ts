import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';

export async function generateSoundingChart(
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
    throw new Error('No sounding data found.');
  }

  const soundingData = entries
    .map((e) => ({
      point: e.station || `S${e.row_index}`,
      easting: parseFloat(String(e.raw_data?.easting || e.raw_data?.e || 0)),
      northing: parseFloat(String(e.raw_data?.northing || e.raw_data?.n || 0)),
      depth: parseFloat(String(e.raw_data?.depth || e.raw_data?.sounding || 0)),
    }))
    .filter((s) => s.depth > 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('HYDROGRAPHIC SOUNDING CHART', 148, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 14, 25);
  doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 250, 25, { align: 'right' });

  const tableData = soundingData.map((s) => [
    s.point,
    s.easting.toFixed(3),
    s.northing.toFixed(3),
    s.depth.toFixed(2),
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Point', 'Easting (m)', 'Northing (m)', 'Depth (m)']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
  });

  return Buffer.from(doc.output('arraybuffer'));
}
