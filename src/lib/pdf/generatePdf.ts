/**
 * Server-side PDF generation using Puppeteer
 * Generates print-ready PDFs from survey report HTML
 */

import puppeteer from 'puppeteer'
import type { SectionContent } from '@/types/surveyReport'

export interface PdfGenerationOptions {
  title: string
  sections: SectionContent[]
  paperSize?: 'A4' | 'A3'
  orientation?: 'portrait' | 'landscape'
}

export async function generatePdf(options: PdfGenerationOptions): Promise<Buffer> {
  const {
    title,
    sections,
    paperSize = 'A4',
  } = options

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  try {
    const page = await browser.newPage()

    // Generate HTML content
    const html = generateReportHtml(title, sections)

    // Set HTML content
    await page.setContent(html, {
      waitUntil: 'load',
    })

    // Wait for fonts and images to load
    await new Promise(resolve => setTimeout(resolve, 1000))

  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: paperSize.toLowerCase() as 'a4' | 'a3',
    printBackground: true,
    margin: {
      top: '10mm',
      right: '10mm',
      bottom: '10mm',
      left: '10mm',
    },
    displayHeaderFooter: false,
    preferCSSPageSize: true,
  })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

function generateReportHtml(title: string, sections: SectionContent[]): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
    }

    .section {
      page-break-after: always;
      margin-bottom: 20px;
    }

    .section:last-child {
      page-break-after: avoid;
    }

    h1 {
      font-size: 18pt;
      text-align: center;
      margin-bottom: 30px;
      color: #1B3A5C;
    }

    h2 {
      font-size: 14pt;
      border-bottom: 2px solid #1B3A5C;
      padding-bottom: 5px;
      margin-top: 0;
      margin-bottom: 15px;
      color: #1B3A5C;
    }

    h3 {
      font-size: 12pt;
      margin-top: 15px;
      margin-bottom: 10px;
      color: #333;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 10pt;
    }

    th, td {
      border: 1px solid #333;
      padding: 6px 8px;
      text-align: left;
      word-break: break-word;
    }

    th {
      background: #f0f0f0;
      font-weight: bold;
      border: 1px solid #333;
    }

    thead {
      display: table-header-group;
    }

    tr:nth-child(even) {
      background: #fafafa;
    }

    p {
      margin: 8px 0;
    }

    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }

    li {
      margin: 5px 0;
    }

    .title-page {
      text-align: center;
      padding: 40px 20px;
    }

    .title-page h1 {
      font-size: 24pt;
      margin-bottom: 40px;
    }

    .title-page .metadata {
      margin: 20px 0;
      font-size: 11pt;
    }

    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80pt;
      color: rgba(27, 58, 92, 0.05);
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
    }

    .content-wrapper {
      position: relative;
      z-index: 1;
    }
  </style>
</head>
<body>
  <div class="watermark">METARDU</div>
  <div class="content-wrapper">
    ${sections
      .map((section) => {
        const isTitlePage = section.sectionNumber === 1
        return `
    <div class="section ${isTitlePage ? 'title-page' : ''}">
      ${
        isTitlePage
          ? section.content
          : `
      <h2>${section.sectionNumber}. ${section.title}</h2>
      ${section.content}
      `
      }
    </div>
      `
      })
      .join('')}
  </div>
</body>
</html>
  `
}

export default generatePdf
