import type { ParsedInput, ExtractedBuildingData, ExtractedAnnotation, BoundingBox2D, ExtractedWall, ExtractedRoom, ExtractedFloor, Point2D } from './types'
import { calculateConfidence } from './fileRouter'

export interface PDFParseOptions {
  scale?: number
  enhanceWithAI?: boolean
}

export async function parsePDFContent(file: File, options: PDFParseOptions = {}): Promise<ParsedInput> {
  const { scale = 2 } = options

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const annotations: ExtractedAnnotation[] = []
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      textContent.items.forEach((item: any, idx: number) => {
        if (item.transform) {
          const x = item.transform[4]
          const y = item.transform[5]
          
          annotations.push({
            id: `annotation_${pageNum}_${idx}`,
            type: 'text',
            position: { easting: x, northing: y },
            content: item.str || '',
            level: pageNum - 1,
          })

          if (x < minE) minE = x
          if (x > maxE) maxE = x
          if (y < minN) minN = y
          if (y > maxN) maxN = y
        }
      })
    }

    const boundingBox: BoundingBox2D = minE === Infinity
      ? { minEasting: 0, maxEasting: 100, minNorthing: 0, maxNorthing: 100 }
      : { minEasting: minE, maxEasting: maxE, minNorthing: minN, maxNorthing: maxN }

    const walls: ExtractedWall[] = []
    
    const width = boundingBox.maxEasting - boundingBox.minEasting
    const height = boundingBox.maxNorthing - boundingBox.minNorthing
    
    walls.push({
      id: 'wall_1',
      type: 'external',
      startPoint: { easting: boundingBox.minEasting, northing: boundingBox.minNorthing },
      endPoint: { easting: boundingBox.maxEasting, northing: boundingBox.minNorthing },
      thickness: 0.2,
      height: 3.0,
      level: 0,
    })
    walls.push({
      id: 'wall_2',
      type: 'external',
      startPoint: { easting: boundingBox.maxEasting, northing: boundingBox.minNorthing },
      endPoint: { easting: boundingBox.maxEasting, northing: boundingBox.maxNorthing },
      thickness: 0.2,
      height: 3.0,
      level: 0,
    })
    walls.push({
      id: 'wall_3',
      type: 'external',
      startPoint: { easting: boundingBox.maxEasting, northing: boundingBox.maxNorthing },
      endPoint: { easting: boundingBox.minEasting, northing: boundingBox.maxNorthing },
      thickness: 0.2,
      height: 3.0,
      level: 0,
    })
    walls.push({
      id: 'wall_4',
      type: 'external',
      startPoint: { easting: boundingBox.minEasting, northing: boundingBox.maxNorthing },
      endPoint: { easting: boundingBox.minEasting, northing: boundingBox.minNorthing },
      thickness: 0.2,
      height: 3.0,
      level: 0,
    })

    const building: ExtractedBuildingData = {
      floors: [{
        id: 'floor_0',
        level: 0,
        name: 'Ground Floor',
        elevation: 0,
        boundingBox,
      }],
      walls,
      rooms: [{
        id: 'room_1',
        name: 'Main Area',
        floor: 0,
        boundary: [
          { easting: boundingBox.minEasting, northing: boundingBox.minNorthing },
          { easting: boundingBox.maxEasting, northing: boundingBox.minNorthing },
          { easting: boundingBox.maxEasting, northing: boundingBox.maxNorthing },
          { easting: boundingBox.minEasting, northing: boundingBox.maxNorthing },
        ],
        area: width * height,
        perimeter: 2 * (width + height),
        height: 3.0,
      }],
      doors: [],
      windows: [],
      columns: [],
      beams: [],
      annotations,
      boundingBox,
      metadata: {
        units: 'meters',
        projectName: file.name.replace(/\.[^/.]+$/, ''),
        scale: '1:100',
      },
    }

    const confidence = calculateConfidence(building) * 0.6

    return {
      type: 'PDF',
      sourceFileName: file.name,
      sourceFileSize: file.size,
      sourceFileLastModified: file.lastModified,
      parsedAt: new Date().toISOString(),
      version: '1.0.0',
      building,
      errors: [],
      warnings: ['PDF text extraction only. For full floor plan analysis, use AI vision.'],
      confidence,
    }
  } catch (error) {
    return {
      type: 'PDF',
      sourceFileName: file.name,
      sourceFileSize: file.size,
      sourceFileLastModified: file.lastModified,
      parsedAt: new Date().toISOString(),
      version: '1.0.0',
      errors: [error instanceof Error ? error.message : 'PDF parsing failed'],
      warnings: ['Ensure pdf.worker.min.js is in /public directory'],
      confidence: 0,
    }
  }
}

export async function rasterizePDFPage(file: File, pageNumber: number = 1, scale: number = 2): Promise<Blob> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(pageNumber)

  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas context not available')

  await page.render({ canvasContext: context, viewport, canvas } as any).promise

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create blob'))
    }, 'image/png')
  })
}