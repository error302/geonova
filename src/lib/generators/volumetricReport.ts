import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';
import { computeVolumeTrapezoidal, computeVolumePrismoidal, CrossSection } from '@/math/volume';

export async function generateVolumetricReport(
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

  if (!entries || entries.length < 2) {
    throw new Error('Insufficient cross-section data. Add at least 2 sections.');
  }

  const sections: CrossSection[] = entries
    .map((e: any) => ({
      chainage: parseFloat(String(e.raw_data?.chainage || e.row_index * 10)),
      area: parseFloat(String(e.raw_data?.area || e.raw_data?.cross_section_area || 0)),
    }))
    .filter((s: any) => s.area > 0)
    .sort((a: any, b: any) => a.chainage - b.chainage);

  if (sections.length < 2) {
    throw new Error('Need at least 2 sections with area > 0');
  }

  const trapezoidal = computeVolumeTrapezoidal(sections);
  let prismoidal = 0;
  let method = 'Trapezoidal Rule';

  try {
    prismoidal = computeVolumePrismoidal(sections);
    method = 'Prismoidal Formula';
  } catch {
    // Not enough sections for prismoidal
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VOLUMETRIC / EARTHWORKS REPORT', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 14, 25);
  doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 196, 25, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CROSS SECTIONS', 14, 35);

  const tableData = sections.map((s: any) => [
    s.chainage.toFixed(2),
    s.area.toFixed(2),
    s.description || '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['Chainage (m)', 'Area (m²)', 'Remark']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('VOLUME SUMMARY', 14, finalY + 10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const summaryData = [
    ['Method Used', method],
    ['Trapezoidal Volume', `${trapezoidal.toFixed(2)} m³`],
    ['Prismoidal Volume', prismoidal > 0 ? `${prismoidal.toFixed(2)} m³` : 'N/A'],
    ['Final Volume (recommended)', `${(prismoidal || trapezoidal).toFixed(2)} m³`],
    ['Number of Sections', sections.length.toString()],
    ['Total Length', `${(sections[sections.length - 1].chainage - sections[0].chainage).toFixed(2)} m`],
  ];

  autoTable(doc, {
    startY: finalY + 15,
    body: summaryData,
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    theme: 'plain',
  });

  return Buffer.from(doc.output('arraybuffer'));
}

