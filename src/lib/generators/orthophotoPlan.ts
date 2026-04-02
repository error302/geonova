import { jsPDF } from 'jspdf';
import { createClient } from '@/lib/supabase/client';

export async function generateOrthophotoPlan(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {
  const { data: project } = await supabase
    .from('projects')
    .select('name, locality, utm_zone, hemisphere')
    .eq('id', projectId)
    .single();

  if (!project) throw new Error('Project not found');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ORTHOPHOTO PLAN', 148, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 14, 25);
  doc.text(`Locality: ${project.locality || 'N/A'}`, 14, 32);
  doc.text(`UTM Zone: ${project.utm_zone || 37}${project.hemisphere || 'S'}`, 250, 25, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString('en-KE')}`, 250, 32, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ORTHOPHOTO METADATA', 14, 45);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('This document serves as a cover sheet for orthophoto deliverables.', 14, 55);
  doc.text('The accompanying GeoTIFF file should be imported into GIS software for analysis.', 14, 62);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text('Note: Upload the orthophoto GeoTIFF via the project files section.', 14, 80);
  doc.text('Coordinate reference: Arc 1960 / UTM', 14, 86);

  return Buffer.from(doc.output('arraybuffer'));
}
