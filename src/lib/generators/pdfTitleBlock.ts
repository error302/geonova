import { jsPDF } from 'jspdf';

export interface TitleBlockData {
  projectName: string;
  surveyType: string;
  reportTitle: string;
  preparedBy?: string;
  date: string;
  refNo?: string;
}

export function drawTitleBlock(doc: jsPDF, data: TitleBlockData): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setDrawColor(30, 80, 100);
  doc.setLineWidth(0.8);
  doc.rect(margin, 10, pageWidth - margin * 2, 42);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('METARDU', margin + 4, 22);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Professional Survey Platform', margin + 4, 27);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(data.reportTitle, pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.projectName, pageWidth / 2, 29, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Survey Type: ${data.surveyType}`, pageWidth / 2, 35, { align: 'center' });

  const rightX = pageWidth - margin - 4;
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Date: ${data.date}`, rightX, 22, { align: 'right' });
  if (data.refNo) doc.text(`Ref: ${data.refNo}`, rightX, 28, { align: 'right' });
  if (data.preparedBy) doc.text(`Prepared by: ${data.preparedBy}`, rightX, 34, { align: 'right' });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, 52, pageWidth - margin, 52);

  return 58;
}

export function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number, projectName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Metardu — ${projectName}`, margin, pageHeight - 7);
  doc.text(
    `Page ${pageNum} of ${totalPages} | Generated ${new Date().toLocaleDateString('en-KE')}`,
    pageWidth - margin,
    pageHeight - 7,
    { align: 'right' }
  );
}

