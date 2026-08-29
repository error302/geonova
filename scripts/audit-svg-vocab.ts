/**
 * Extract all SVG tags + attributes used by the survey plan renderers,
 * so the DOMPurify whitelist in sanitize.ts can be extended precisely.
 * Run: npx tsx scripts/audit-svg-vocab.ts
 */
import { SurveyPlanRenderer } from '../src/lib/reports/surveyPlan/renderer'
import { FormNo4Renderer } from '../src/lib/reports/surveyPlan/formNo4Renderer'
import { demoData } from './svg-vocab-demo-data'

const tags = new Set<string>()
const attrs = new Set<string>()

function collect(svg: string) {
  // tags
  for (const m of svg.matchAll(/<([a-zA-Z:][\w:-]*)/g)) tags.add(m[1])
  // attributes
  for (const m of svg.matchAll(/([\w:-]+)\s*=/g)) attrs.add(m[1])
}

// Standard renderer
const r1 = new SurveyPlanRenderer(demoData as any)
collect(r1.render())

// Form No.4 renderer (add folio data so it takes that path)
const data4 = {
  ...demoData,
  project: { ...demoData.project, folioNumber: 'FR 105/1', registerNumber: 'IR 55555', lrNumber: 'LR 2090/105' },
}
const r2 = new FormNo4Renderer(data4 as any, {} as any)
collect((r2 as any).renderFormNo4())

console.log('TAGS:', JSON.stringify([...tags].sort(), null, 0))
console.log()
console.log('ATTRS:', JSON.stringify([...attrs].sort(), null, 0))
