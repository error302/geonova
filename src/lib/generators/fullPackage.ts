import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/client';

export async function generateFullPackage(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {

  const { data: readyDocs } = await supabase
    .from('submission_documents')
    .select('document_id, file_url')
    .eq('project_id', projectId)
    .eq('status', 'ready')
    .neq('document_id', 'full-package');

  if (!readyDocs || readyDocs.length === 0) {
    throw new Error('No ready documents found. Generate individual documents before creating the full package.');
  }

  const zip = new JSZip();
  const folder = zip.folder('submission') ?? zip;

  for (const doc of readyDocs) {
    if (!doc.file_url) continue;
    try {
      const res = await fetch(doc.file_url);
      if (!res.ok) continue;
      const blob = await res.arrayBuffer();
      const ext = doc.file_url.split('.').pop() ?? 'bin';
      folder.file(`${doc.document_id}.${ext}`, blob);
    } catch {
      // Skip failed fetches
    }
  }

  folder.file('README.txt', [
    'METARDU SUBMISSION PACKAGE',
    '===========================',
    `Generated: ${new Date().toISOString()}`,
    `Documents included: ${readyDocs.length}`,
    '',
    'Contents:',
    ...readyDocs.map((d) => `  - ${d.document_id}`),
    '',
    'Prepared by Metardu — Professional Survey Platform',
  ].join('\n'));

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return Buffer.from(buffer);
}
