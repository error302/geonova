import type { CellValue } from 'exceljs'
import type { ParsedInput, BOQData, BOQItem } from './types'

export async function parseBOQSpreadsheet(file: File): Promise<ParsedInput> {
  try {
    const ExcelJS = await import('exceljs')

    const arrayBuffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)

    const firstSheet = workbook.worksheets[0]
    if (!firstSheet) {
      return {
        type: 'BOQ',
        sourceFileName: file.name,
        sourceFileSize: file.size,
        sourceFileLastModified: file.lastModified,
        parsedAt: new Date().toISOString(),
        version: '1.0.0',
        errors: ['BOQ file appears empty or has no sheets'],
        warnings: [],
        confidence: 0,
      }
    }

    // Convert worksheet rows to a 2D array (similar to sheet_to_json with header: 1)
    const jsonData: CellValue[][] = []
    firstSheet.eachRow({ includeEmpty: false }, (row) => {
      const rowArray: CellValue[] = []
      for (let col = 1; col <= row.cellCount; col++) {
        const cell = row.getCell(col)
        rowArray.push(cell.value ?? '')
      }
      jsonData.push(rowArray)
    })

    if (jsonData.length < 2) {
      return {
        type: 'BOQ',
        sourceFileName: file.name,
        sourceFileSize: file.size,
        sourceFileLastModified: file.lastModified,
        parsedAt: new Date().toISOString(),
        version: '1.0.0',
        errors: ['BOQ file appears empty or has no data rows'],
        warnings: [],
        confidence: 0,
      }
    }

    const headers = jsonData[0].map((h: CellValue) => String(h || '').toLowerCase().trim())

    const findColumn = (patterns: string[]): number => {
      return headers.findIndex(h => patterns.some((p) => h.includes(p)))
    }

    const descCol = findColumn(['description', 'item', 'work', 'description', 'particular'])
    const qtyCol = findColumn(['quantity', 'qty', 'amount', 'num', 'no.'])
    const unitCol = findColumn(['unit', 'units', 'measure'])
    const rateCol = findColumn(['rate', 'price', 'unit rate', 'u.rate', 'unit price'])
    const catCol = findColumn(['category', 'group', 'section', 'type'])

    if (descCol === -1 || qtyCol === -1) {
      return {
        type: 'BOQ',
        sourceFileName: file.name,
        sourceFileSize: file.size,
        sourceFileLastModified: file.lastModified,
        parsedAt: new Date().toISOString(),
        version: '1.0.0',
        errors: ['Could not find required columns (Description, Quantity)'],
        warnings: ['Ensure BOQ has proper column headers'],
        confidence: 0,
      }
    }

    const items: BOQItem[] = []
    let subtotal = 0
    const currency = 'KES'

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || !row[descCol]) continue

      const description = String(row[descCol] || '')
      const quantity = parseFloat(String(row[qtyCol])) || 0
      const unit = String(row[unitCol] || 'item')
      const unitRate = parseFloat(String(row[rateCol])) || 0
      const totalRate = quantity * unitRate
      const category = catCol !== -1 ? String(row[catCol] || 'General') : 'General'

      if (description && quantity > 0) {
        items.push({
          id: `boq_${i}`,
          description,
          unit,
          quantity,
          unitRate,
          totalRate,
          category,
        })
        subtotal += totalRate
      }
    }

    const boq: BOQData = {
      items,
      currency,
      subtotal,
      tax: subtotal * 0.16,
      total: subtotal * 1.16,
      sourceFileName: file.name,
    }

    return {
      type: 'BOQ',
      sourceFileName: file.name,
      sourceFileSize: file.size,
      sourceFileLastModified: file.lastModified,
      parsedAt: new Date().toISOString(),
      version: '1.0.0',
      boq,
      errors: [],
      warnings: [],
      confidence: 0.85,
    }
  } catch (error) {
    return {
      type: 'BOQ',
      sourceFileName: file.name,
      sourceFileSize: file.size,
      sourceFileLastModified: file.lastModified,
      parsedAt: new Date().toISOString(),
      version: '1.0.0',
      errors: [error instanceof Error ? error.message : 'BOQ parsing failed'],
      warnings: ['Ensure exceljs is properly installed'],
      confidence: 0,
    }
  }
}
