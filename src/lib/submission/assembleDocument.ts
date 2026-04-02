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
