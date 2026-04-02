import { createClient } from '@/lib/supabase/client';

interface GenerateDocumentInput {
  projectId: string;
  documentId: string;
  surveyType: string;
  supabase: ReturnType<typeof createClient>;
}

interface GenerateDocumentResult {
  fileUrl: string;
}

export async function generateDocument(
  input: GenerateDocumentInput
): Promise<GenerateDocumentResult> {
  const { projectId, documentId, surveyType, supabase } = input;

  let buffer: Buffer;
  let fileName: string;
  let mimeType: string;

  switch (documentId) {
    case 'traverse-report': {
      const { generateTraverseReport } = await import('../generators/traverseReport');
      buffer = await generateTraverseReport(projectId, supabase);
      fileName = `traverse-report-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'levelling-report': {
      const { generateLevellingReport } = await import('../generators/levellingReport');
      buffer = await generateLevellingReport(projectId, supabase);
      fileName = `levelling-report-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'field-book': {
      const { generateFieldBookExcel } = await import('../generators/fieldBookExcel');
      buffer = await generateFieldBookExcel(projectId, supabase);
      fileName = `field-book-${projectId}.xlsx`;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
    }
    case 'control-schedule': {
      const { generateCoordinateSchedule } = await import('../generators/coordinateSchedule');
      buffer = await generateCoordinateSchedule(projectId, supabase);
      fileName = `coordinate-schedule-${projectId}.xlsx`;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
    }
    case 'full-package': {
      const { generateFullPackage } = await import('../generators/fullPackage');
      buffer = await generateFullPackage(projectId, supabase);
      fileName = `submission-package-${projectId}.zip`;
      mimeType = 'application/zip';
      break;
    }
    case 'deed-plan': {
      if (surveyType !== 'cadastral') {
        throw new Error('Deed Plan is only available for cadastral surveys.');
      }
      const { generateDeedPlan } = await import('../generators/deedPlan');
      buffer = await generateDeedPlan(projectId, supabase);
      fileName = `deed-plan-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'working-diagram': {
      const { generateWorkingDiagramPdf } = await import('../generators/workingDiagram');
      buffer = await generateWorkingDiagramPdf(projectId, supabase);
      fileName = `working-diagram-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'boundary-shapefile': {
      const { generateBoundaryShapefile } = await import('../generators/boundaryShapefile');
      buffer = await generateBoundaryShapefile(projectId, supabase);
      fileName = `boundary-shapefile-${projectId}.zip`;
      mimeType = 'application/zip';
      break;
    }
    case 'setting-out-dxf': {
      const { generateSettingOutDxf } = await import('../generators/settingOutDxf');
      buffer = await generateSettingOutDxf(projectId, supabase);
      fileName = `setting-out-${projectId}.dxf`;
      mimeType = 'application/dxf';
      break;
    }
    case 'longitudinal-section': {
      const { generateLongitudinalSection } = await import('../generators/longitudinalSection');
      buffer = await generateLongitudinalSection(projectId, supabase);
      fileName = `longitudinal-section-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'volumetric-report': {
      const { generateVolumetricReport } = await import('../generators/volumetricReport');
      buffer = await generateVolumetricReport(projectId, supabase);
      fileName = `volumetric-report-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'gcp-report': {
      const { generateGcpReport } = await import('../generators/gcpReport');
      buffer = await generateGcpReport(projectId, supabase);
      fileName = `gcp-report-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'orthophoto-plan': {
      const { generateOrthophotoPlan } = await import('../generators/orthophotoPlan');
      buffer = await generateOrthophotoPlan(projectId, supabase);
      fileName = `orthophoto-plan-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'sounding-chart': {
      const { generateSoundingChart } = await import('../generators/soundingChart');
      buffer = await generateSoundingChart(projectId, supabase);
      fileName = `sounding-chart-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    case 'deformation-report': {
      const { generateDeformationReport } = await import('../generators/deformationReport');
      buffer = await generateDeformationReport(projectId, supabase);
      fileName = `deformation-report-${projectId}.pdf`;
      mimeType = 'application/pdf';
      break;
    }
    default:
      throw new Error(`Generator not yet implemented for: ${documentId}. This document type is coming in a future phase.`);
  }

  const storagePath = `submissions/${projectId}/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data: signedUrl } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (!signedUrl?.signedUrl) throw new Error('Failed to create signed URL');

  return { fileUrl: signedUrl.signedUrl };
}
