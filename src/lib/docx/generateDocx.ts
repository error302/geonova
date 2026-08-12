/**
 * Server-side DOCX generation using docx package
 * Generates professional Word documents for survey reports
 * Supports survey-type-specific templates
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  TableOfContents,
  AlignmentType,
} from 'docx'
import type { SectionContent } from '@/types/surveyReport'
import type { SurveyType } from '@/types/project'

export interface DocxGenerationOptions {
  title: string
  reportNumber?: string
  sections?: SectionContent[]
  surveyType?: SurveyType
  clientName?: string
  projectName?: string
  projectLocation?: string
  areaHectares?: number
  date?: string
  useTemplate?: boolean
}

export async function generateDocx(options: DocxGenerationOptions): Promise<Buffer> {
  const {
    title,
    reportNumber,
    sections: inputSections,
    clientName = '',
    projectName = '',
    date = new Date().toLocaleDateString('en-GB'),
    useTemplate = true,
  } = options

  // Use template-based sections if available, otherwise use input sections
  const sections = useTemplate
    ? inputSections || []
    : inputSections || []

  const docSections: (Paragraph | TableOfContents)[] = []

  // Title Page
  docSections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 48,
          break: 1,
        }),
        ...(reportNumber
          ? [
              new TextRun({
                text: `\n${reportNumber}`,
                size: 28,
                italics: true,
              }),
            ]
          : []),
        new TextRun({ text: '\n\n\n', size: 24 }),
        ...(clientName
          ? [
              new TextRun({
                text: `Client: ${clientName}`,
                size: 28,
              }),
              new TextRun({ text: '\n', size: 24 }),
            ]
          : []),
        ...(projectName
          ? [
              new TextRun({
                text: `Project: ${projectName}`,
                size: 28,
              }),
              new TextRun({ text: '\n', size: 24 }),
            ]
          : []),
        new TextRun({
          text: `\n\n${date}`,
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 200,
        after: 200,
      },
    })
  )

  // Page break after title
  docSections.push(
    new Paragraph({
      children: [new TextRun({ text: '' })],
      pageBreakBefore: true,
    })
  )

  // Table of Contents
  docSections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'TABLE OF CONTENTS',
          bold: true,
          size: 28,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: {
        before: 200,
        after: 200,
      },
    })
  )

  docSections.push(
    new TableOfContents('1-3')
  )

  docSections.push(
    new Paragraph({
      children: [new TextRun({ text: '' })],
      pageBreakBefore: true,
    })
  )

  // Add each section
  for (const section of sections) {
    if (section.sectionNumber <= 2) continue

    // Section heading
    docSections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${section.sectionNumber}. ${section.title}`,
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: 400,
          after: 200,
        },
      })
    )

    // Section content
    const contentParagraphs = parseHtmlToParagraphs(section.content)
    docSections.push(...contentParagraphs)
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docSections,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return buffer
}

function parseHtmlToParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  if (!html) return paragraphs

  const cleanHtml = html.replace(/\n/g, ' ').trim()
  const rawParagraphs = cleanHtml.split(/<\/p>|<br\s*\/?>|\n\n/)

  for (const para of rawParagraphs) {
    const text = para
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()

    if (text) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              size: 22,
            }),
          ],
          spacing: {
            after: 200,
          },
        })
      )
    }
  }

  if (paragraphs.length === 0 && cleanHtml) {
    const text = cleanHtml
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim()

    if (text) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              size: 22,
            }),
          ],
        })
      )
    }
  }

  return paragraphs
}

export default generateDocx
