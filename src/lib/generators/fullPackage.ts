import JSZip from 'jszip';
import db from '@/lib/db';

export async function generateFullPackage(
  projectId: string
): Promise<Buffer> {

  const readyDocsRes = await db.query<{ document_id: string; file_url: string }>(
    "SELECT document_id, file_url FROM submission_documents WHERE project_id = $1 AND status = 'ready' AND document_id != 'full-package'",
    [projectId]
  );
  const readyDocs = readyDocsRes.rows;

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
    ...readyDocs.map((d: { document_id: string; file_url: string }) => `  - ${d.document_id}`),
    '',
    'Prepared by Metardu — Professional Survey Platform',
  ].join('\n'));

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return Buffer.from(buffer);
}

