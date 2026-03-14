export interface JobXMLRecord {
  pointId: string
  easting?: number
  northing?: number
  elevation?: number
  code?: string
  note?: string
}

export function parseJobXML(content: string): {
  ok: boolean
  records: JobXMLRecord[]
  warnings: string[]
  jobName?: string
} {
  const warnings: string[] = []
  const records: JobXMLRecord[] = []

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/xml')

    const jobName = doc.querySelector('JOBFile')
      ?.getAttribute('JobName') || undefined

    const pointRecords = doc.querySelectorAll('PointRecord')
    pointRecords.forEach(pr => {
      const id = pr.querySelector('Name')?.textContent?.trim()
      if (!id) return

      const northing = parseFloat(
        pr.querySelector('Grid > North')?.textContent || '0'
      )
      const easting = parseFloat(
        pr.querySelector('Grid > East')?.textContent || '0'
      )
      const elevation = parseFloat(
        pr.querySelector('Grid > Elev')?.textContent || '0'
      )
      const code = pr.querySelector('Code')?.textContent?.trim()

      records.push({ 
        pointId: id, 
        easting, 
        northing, 
        elevation,
        code
      })
    })

    const obsRecords = doc.querySelectorAll('RawObservation')
    obsRecords.forEach(obs => {
      const id = obs.querySelector('TargetID')?.textContent?.trim()
      if (!id || records.find(r => r.pointId === id)) return
      warnings.push(`Raw observation for ${id} — no coordinates computed`)
    })

    return { ok: true, records, warnings, jobName }

  } catch (err) {
    return { 
      ok: false, 
      records: [], 
      warnings: ['Failed to parse JobXML file — check file format'] 
    }
  }
}
