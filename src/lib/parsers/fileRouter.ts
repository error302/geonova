import {
  ParsedInput,
  ParsedInputType,
  ExtractedBuildingData,
  BOQData,
  ParseResult,
  MAX_FILE_SIZE,
  SUPPORTED_EXTENSIONS,
  PARSER_VERSION,
} from './types'
import { parseDXFFileContent } from './parseDXF'
import { parsePDFContent } from './parsePDF'
import { parseGLTFFile, parseOBJFile } from './parse3D'
import { parseBOQSpreadsheet } from './parseBOQ'

export interface RouteFileOptions {
  file: File
  enhanceWithAI?: boolean
}

export function getFileType(filename: string): ParsedInputType {
  const ext = filename.toLowerCase().split('.').pop() || ''
  
  for (const [type, extensions] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return type as ParsedInputType
    }
  }
  
  return 'UNKNOWN'
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }
  }
  
  const type = getFileType(file.name)
  if (type === 'UNKNOWN') {
    return { valid: false, error: 'Unsupported file format' }
  }
  
  return { valid: true }
}

export async function routeFile(options: RouteFileOptions): Promise<ParsedInput> {
  const { file, enhanceWithAI = true } = options
  const type = getFileType(file.name)
  
  const baseResult: ParsedInput = {
    type,
    sourceFileName: file.name,
    sourceFileSize: file.size,
    sourceFileLastModified: file.lastModified,
    parsedAt: new Date().toISOString(),
    version: PARSER_VERSION,
    errors: [],
    warnings: [],
    confidence: 0,
  }
  
  try {
    switch (type) {
      case 'DXF':
        return await parseDXF(file, baseResult, enhanceWithAI)
      case 'DWG':
        return await parseDWG(file, baseResult, enhanceWithAI)
      case 'IFC':
        return await parseIFC(file, baseResult, enhanceWithAI)
      case 'PDF':
        return await parsePDF(file, baseResult, enhanceWithAI)
      case 'IMAGE':
        return await parseImage(file, baseResult, enhanceWithAI)
      case 'GLTF':
        return await parseGLTF(file, baseResult, enhanceWithAI)
      case 'OBJ':
        return await parseOBJ(file, baseResult, enhanceWithAI)
      case 'BOQ':
        return await parseBOQ(file, baseResult)
      default:
        return { ...baseResult, errors: ['Unknown file type'] }
    }
  } catch (error) {
    return {
      ...baseResult,
      errors: [error instanceof Error ? error.message : 'Parse failed'],
    }
  }
}

async function parseDXF(file: File, base: ParsedInput, enhance: boolean): Promise<ParsedInput> {
  const content = await file.text()
  return await parseDXFFileContent(content, file.name)
}

async function parseDWG(file: File, base: ParsedInput, enhance: boolean): Promise<ParsedInput> {
  return {
    ...base,
    errors: ['DWG files require conversion to DXF. Please export from AutoCAD as DXF or use LibreCAD.'],
  }
}

async function parseIFC(file: File, base: ParsedInput, enhance: boolean): Promise<ParsedInput> {
  return {
    ...base,
    errors: ['IFC parsing not yet implemented'],
    warnings: ['Install web-ifc to enable IFC/BIM parsing'],
  }
}

async function parsePDF(file: File, base: ParsedInput, enhance: boolean): Promise<ParsedInput> {
  return await parsePDFContent(file)
}

async function parseImage(file: File, base: ParsedInput, enhance: boolean): Promise<ParsedInput> {
  return {
    ...base,
    errors: ['Image parsing not yet implemented'],
    warnings: ['Image parsing requires AI vision. Coming soon.'],
  }
}

async function parseGLTF(file: File, base: ParsedInput, enhance: boolean): Promise<ParsedInput> {
  return await parseGLTFFile(file)
}

async function parseOBJ(file: File, base: ParsedInput, enhance: boolean): Promise<ParsedInput> {
  return await parseOBJFile(file)
}

async function parseBOQ(file: File, base: ParsedInput): Promise<ParsedInput> {
  return await parseBOQSpreadsheet(file)
}

export function calculateConfidence(data: ExtractedBuildingData): number {
  let score = 0.5
  
  if (data.walls.length > 0) score += 0.15
  if (data.rooms.length > 0) score += 0.15
  if (data.annotations.length > 0) score += 0.1
  if (data.metadata.projectName) score += 0.05
  if (data.metadata.scale) score += 0.05
  
  return Math.min(1, score)
}

export async function enhanceWithAI(
  data: ExtractedBuildingData,
  format: ParsedInputType,
  context?: string
): Promise<ExtractedBuildingData> {
  throw new Error('TODO: enhanceWithAI not implemented - requires Anthropic/Claude API')
}