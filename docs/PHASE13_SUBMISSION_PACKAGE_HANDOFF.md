# Phase 13 Submission Package Handoff Plan

## Purpose

This plan turns METARDU from a collection of strong survey tools into a benchmark-aligned Kenya submission workflow.
It is written so another agent can pick up the work without re-discovering the problem, the sample package structure, or the architecture gaps.

## Why This Phase Exists

The app already does many computations and document outputs well, but the benchmark files from the user's friend show that submission readiness is not just about correct math.
It is also about:

- package order
- sheet density
- office-style title blocks and side tables
- datum consistency checks
- theoretical computations
- final coordinate lists
- area summaries
- explicit surveyor report narrative
- one coherent package generated from one source of truth

The current product has parts of this, but they are spread across duplicated routes and separate document engines.

## Benchmark Inputs Reviewed

The following benchmark files were used to ground this phase:

- `C:\Users\ADMIN\Downloads\Drawing5 ACRES WORKING MODEL-Model.pdf`
- `C:\Users\ADMIN\Downloads\4 ACRES WORKING DIAGRAM-Model.pdf`
- `C:\Users\ADMIN\Downloads\5 acres compilation NEW.xlsx`
- `C:\Users\ADMIN\Downloads\FINAL THEORETICAL COMPUTATIONS FOR 4 ACRES.xlsx`
- `C:\Users\ADMIN\Downloads\583_58 (1).jpg`

Notes:

- The PDFs were generated from Autodesk Civil 3D 2022 according to PDF metadata.
- Direct DWG parsing was not completed in this pass, but the PDF and workbook outputs were enough to establish the package structure and expected sheet style.

## What The Benchmark Package Contains

From the two workbooks, the benchmark package repeatedly follows this order:

1. Surveyor's report
2. Index to computations
3. Final coordinate list
4. Working diagram
5. Theoretical computations
6. RTK result
7. Consistency checks
8. Area computations

### Benchmark Workbook Findings

#### `5 acres compilation NEW.xlsx`

- Contains an explicit package index sheet.
- Final coordinate list includes:
  - station
  - northings
  - eastings
  - class of beacon
  - description
- Datum joins sheet includes:
  - pairwise joins
  - delta northing
  - delta easting
  - distance
  - bearing
- Consistency of datum sheet marks adopted plan values.
- Theoreticals sheet is line-by-line and beacon-by-beacon.
- Consistency checks sheet compares computed values against "should be" coordinates.
- Area sheet includes parcel-by-parcel area plus total area, F/R area, and discrepancy.

#### `FINAL THEORETICAL COMPUTATIONS FOR 4 ACRES.xlsx`

- Includes a narrative surveyor report sheet with:
  - approval reference
  - datum reference
  - method narrative
  - conclusion
  - sign/date area
- Repeats the same package order as above.
- Makes the method explicit:
  - working diagram prepared from approved scheme + F/R
  - AutoCAD used for theoretical computations
  - GNSS RTK used for staking and checks
  - consistency checks run after plan production

### Benchmark Sheet Layout Findings

From the image and PDFs:

- Working sheet is dense, not minimal.
- Main drawing occupies the center.
- Several side tables sit around the drawing, especially coordinate and line tables.
- Title block includes folio, register number, form number, scale, date, surveyor and checker areas.
- Drawing contains many callouts, dimensions, bearings, parcel labels, and handoff metadata.
- The output looks like an office-issued survey document, not a generic web export.

## What METARDU Already Does Better Than The Manual Workflow

- Keeps geometric data structured instead of scattering truth across DWG, XLSX, and handwritten notes.
- Reuses project data across plans, reports, exports, and checks.
- Can compute and validate faster than the manual benchmark workflow.
- Already has strong engines for:
  - traverse accuracy
  - leveling
  - working diagrams and survey plans
  - mutation forms and document package HTML
  - survey report generation

## What METARDU Still Lacks Compared To The Benchmark

### Missing or weak compared to the benchmark package

- One canonical submission package model
- One canonical package order and export flow
- Benchmark-aligned computation book assembly
- Submission number format and revision policy
- Persistent surveyor identity linked everywhere
- Seal / signature asset handling
- Formal package completeness validationGood. I can see the benchmark image clearly — that's Form No. 4, Folio 583, Register 58, Scale 1:3000. Let me study it and the Phase 13 plan together, then write the brief.

**What the benchmark image tells me that the Phase 13 plan didn't fully capture:**

The real Kenyan survey plan has a very specific layout:
- Two large coordinate tables top-left and top-right with columns: Station / Northings / Eastings / Heights / Class of Beacon
- "Theoretical" and "I.P.C.U." beacon class annotations inline in the table
- Dense bearing/distance callouts directly on every boundary line
- LR numbers on every parcel
- An inset at 1:1000 scale for the complex corner detail (top right and bottom left)
- The title block at the bottom has: Registration date, File Reference, Computations No., Field Book No., Provisional/Final Approval, Authentication columns
- Bottom: Folio No. and Register No. as large standalone text
- Surveyor's declaration bottom-left with stamp/seal area
- "All new roads are 12.00m wide / All road truncations ±6mm" notes embedded in the drawing

**On the DWG limitation:** DWG is Autodesk's proprietary binary format. You cannot parse it in a browser or Node.js without a commercial SDK (Open Design Alliance costs ~$10k/year). The practical fix is:

1. **Import side** — accept DXF only (which AutoCAD/Civil 3D can export for free). Add a DWG→DXF conversion note in the UI.
2. **Export side** — Metardu already exports DXF. Keep it. DXF opens in AutoCAD, Civil 3D, QGIS, and LibreCAD.
3. **For users with DWG files** — add a one-click instruction in the UI: *"Open in AutoCAD → Save As → DXF 2018 → Upload here"*

Now the brief:

---

## Phase 13 Brief — Submission Package

**Objective:** Turn Metardu into a benchmark-aligned Kenya submission workflow. One project → one submission record → one complete package.

**Benchmark target:** Form No. 4 survey plan as seen in `583_58(1).jpg` — dense office-issued sheet with coordinate tables, LR annotations, inset diagrams, and formal title block.

---

### Workstream 1 — Canonical Submission Domain Model

**File:** `supabase/migrations/[timestamp]_create_project_submissions.sql`

```sql
create table project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  surveyor_profile_id uuid references surveyor_profiles(id),
  submission_number text not null,
  revision_code text not null default 'R00',
  submission_year integer not null,
  package_status text not null default 'draft'
    check (package_status in ('draft','incomplete','ready','submitted')),
  required_sections jsonb not null default '[]',
  generated_artifacts jsonb not null default '{}',
  supporting_attachments jsonb not null default '{}',
  validation_results jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table project_submissions enable row level security;

create policy "owner access" on project_submissions
  for all using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create table submission_sequence (
  surveyor_profile_id uuid not null references surveyor_profiles(id),
  year integer not null,
  last_sequence integer not null default 0,
  primary key (surveyor_profile_id, year)
);

alter table submission_sequence enable row level security;

create policy "owner access" on submission_sequence
  for all using (
    surveyor_profile_id in (
      select id from surveyor_profiles where user_id = auth.uid()
    )
  );
```

**File:** `src/types/submission.ts`

```typescript
export interface ProjectSubmission {
  id: string
  project_id: string
  surveyor_profile_id: string
  submission_number: string      // e.g. "RS149_2025_002_R00"
  revision_code: string          // "R00", "R01", etc.
  submission_year: number
  package_status: 'draft' | 'incomplete' | 'ready' | 'submitted'
  required_sections: SubmissionSection[]
  generated_artifacts: Record<string, string>   // section_id → storage path
  supporting_attachments: Record<string, string> // slot_id → storage path
  validation_results: ValidationResult[]
  created_at: string
  updated_at: string
}

export interface SubmissionSection {
  id: string
  order: number
  label: string
  required: boolean
  status: 'missing' | 'pending' | 'ready'
  artifact_key?: string
}

export interface ValidationResult {
  section_id: string
  passed: boolean
  message: string
}

// Benchmark-aligned section order (matches 5 acres compilation + 4 acres theoretical)
export const SUBMISSION_SECTIONS: SubmissionSection[] = [
  { id: 'surveyor_report',       order: 1, label: "Surveyor's Report",          required: true,  status: 'missing' },
  { id: 'index',                 order: 2, label: 'Index to Computations',       required: true,  status: 'missing' },
  { id: 'coordinate_list',       order: 3, label: 'Final Coordinate List',       required: true,  status: 'missing' },
  { id: 'working_diagram',       order: 4, label: 'Working Diagram',             required: true,  status: 'missing' },
  { id: 'theoretical_comps',     order: 5, label: 'Theoretical Computations',    required: true,  status: 'missing' },
  { id: 'rtk_result',            order: 6, label: 'RTK / Field Result Bundle',   required: false, status: 'missing' },
  { id: 'consistency_checks',    order: 7, label: 'Consistency Checks',          required: true,  status: 'missing' },
  { id: 'area_computations',     order: 8, label: 'Area Computations',           required: true,  status: 'missing' },
]
```

---

### Workstream 2 — Surveyor Identity Unification

**File:** `src/lib/submission/surveyorProfile.ts`

```typescript
import { createClient } from '@/lib/supabase/client'

export interface SurveyorProfile {
  id: string
  user_id: string
  full_name: string
  registration_number: string   // e.g. "RS149" — used in submission number
  firm_name?: string
  seal_url?: string             // Supabase storage path to seal image
  signature_url?: string
}

export async function getActiveSurveyorProfile(): Promise<SurveyorProfile | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await supabase
    .from('surveyor_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle()

  return data as SurveyorProfile | null
}
```

**Hard rule:** Remove all `localStorage.getItem('surveyorName')` / `localStorage.getItem('registrationNo')` references from `src/app/project/[id]/documents/page.tsx` and replace with `getActiveSurveyorProfile()`. Every official document must source identity from this function only.

---

### Workstream 3 — Submission Numbering

**File:** `src/lib/submission/numbering.ts`

```typescript
import { createClient } from '@/lib/supabase/client'

export async function generateSubmissionNumber(
  surveyorProfileId: string,
  registrationNo: string
): Promise<{ submissionNumber: string; sequence: number; year: number }> {
  const supabase = createClient()
  const year = new Date().getFullYear()

  // Atomically increment sequence
  const { data, error } = await supabase.rpc('increment_submission_sequence', {
    p_surveyor_profile_id: surveyorProfileId,
    p_year: year,
  })

  if (error) throw error
  const seq = data as number

  const submissionNumber = `${registrationNo}_${year}_${String(seq).padStart(3, '0')}_R00`
  return { submissionNumber, sequence: seq, year }
}

export function incrementRevision(submissionNumber: string): string {
  // RS149_2025_002_R00 → RS149_2025_002_R01
  const parts = submissionNumber.split('_')
  const revPart = parts[parts.length - 1]
  const revNum = parseInt(revPart.replace('R', ''), 10)
  parts[parts.length - 1] = `R${String(revNum + 1).padStart(2, '0')}`
  return parts.join('_')
}
```

**Supabase function** (add to a new migration):

```sql
create or replace function increment_submission_sequence(
  p_surveyor_profile_id uuid,
  p_year integer
) returns integer language plpgsql security definer as $$
declare
  v_seq integer;
begin
  insert into submission_sequence (surveyor_profile_id, year, last_sequence)
  values (p_surveyor_profile_id, p_year, 1)
  on conflict (surveyor_profile_id, year)
  do update set last_sequence = submission_sequence.last_sequence + 1
  returning last_sequence into v_seq;
  return v_seq;
end;
$$;
```

---

### Workstream 4 — Workstream 10 (Deduplication) — Do This Before Building Anything Else

**Decision to make in code — canonical workspace route is:**
`src/app/project/[id]/page.tsx`

Delete or redirect `src/app/project/[id]/workspace/page.tsx` to the above.

**Decision — canonical report engine is:**
`src/lib/reports/surveyReport/index.ts`

Delete `src/lib/compute/surveyReportSections.ts` after migrating any unique logic into the canonical engine.

---

### Workstream 5 — Survey Plan Upgrade to Form No. 4 Standard

This is the most visible gap. The benchmark image shows exactly what's needed.

**File:** `src/lib/reports/surveyPlan/types.ts` — add these fields:

```typescript
export interface SurveyPlanTitleBlock {
  // Existing fields kept
  projectTitle: string
  clientName: string
  surveyorName: string
  registrationNumber: string
  firmName?: string
  sealImageUrl?: string

  // New fields from Form No. 4 benchmark
  folioNumber: string           // "583" — from Land Registry
  registerNumber: string        // "58"
  lrNumber: string              // "LR No. 7185/59-65"
  plotParcelNumber: string
  refMapRIM: string             // "R.I.M N.A 36/9-14-3..."
  registrationBlock: string
  registrationDistrict: string
  locality: string
  formNumber: string            // "Form No. 4"
  computationsNo: string
  fieldBookNo: string
  dateReceived: string
  fileReference: string
  scale: string                 // "1:3000"

  // Authentication block
  examinedBy: string
  examinedDate: string
  approvedBy: string
  approvedDate: string
  authenticatedBy: string
  authenticatedDate: string

  // Surveyor declaration
  declarationText: string
  surveyorSignatureUrl?: string
  declarationDate: string
  letterNo: string              // "ISK/FPS/25/46/XI/105"
}

export interface CoordinateScheduleEntry {
  station: string
  northing: number
  easting: number
  height?: number
  beaconClass: 'new' | 'old' | 'theoretical' | 'I.P.C.U.'
  description?: string
}

export interface InsetDiagram {
  scale: string                 // "1:1000"
  beacons: string[]             // beacon IDs included in inset
  position: 'top-right' | 'bottom-left'
  labelText: string             // "INSET SCALE 1:1000"
  notToScale: boolean
}
```

**File:** `src/lib/reports/surveyPlan/renderer.ts` — add these rendering rules on top of existing renderer:

```typescript
// RULE 1: Coordinate tables
// Split beacons into two tables: left side (P-series, K-series) and right side (N-series, D-series)
// Each table: Station | Northings | Eastings | Heights | Class of Beacon
// "Theoretical" and "I.P.C.U." appear as inline text in the Class column, not icons

// RULE 2: Inset diagrams
// Any complex corner or road truncation area must render as a separate inset at higher scale
// Label as "INSET SCALE 1:1000" with "INSET NOT TO SCALE" if schematic

// RULE 3: Road annotations
// Add note text: "All new roads are 12.00m Wide"
// Add note text: "All road truncations ±6mm"
// These appear as callout text on the drawing, not in the title block

// RULE 4: LR numbers on parcels
// Every parcel polygon must display its LR number as text
// Format: "LR No. 7185/59" with area below: "A=co=03.311.0 Ha"
// Add "D.P No. A72482" reference where applicable

// RULE 5: Submission number in header and footer
// Submission number (e.g. RS149_2025_002_R00) must appear in header and footer of every sheet

// RULE 6: Grid lines
// Eastings and Northings grid lines with coordinate values on margins
// Format: "114300", "114400" etc. as margin labels

// RULE 7: Title block bottom of sheet
// Registration | Transaction | Authentication | Date | Records | Date
// All six columns rendered as a table spanning full sheet width
// Below table: "Folio No. ___" and "Register No. ___" as large standalone text
// FIR No. appears below Register No.
```

---

### Workstream 6 — Computation Workbook Generator

**File:** `src/lib/submission/workbook/generateWorkbook.ts`

```typescript
import * as XLSX from 'xlsx'

export function generateSubmissionWorkbook(data: SubmissionWorkbookData): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  // Sheet order matches benchmark exactly
  addSurveyorReportSheet(wb, data)
  addIndexSheet(wb, data)
  addCoordinateListSheet(wb, data)
  addDatumJoinsSheet(wb, data)
  addConsistencyOfDatumSheet(wb, data)
  addTheoreticalComputationsSheet(wb, data)
  if (data.rtkResults) addRTKResultSheet(wb, data)
  addConsistencyChecksSheet(wb, data)
  addAreaComputationsSheet(wb, data)

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
```

**Coordinate List sheet columns** (from benchmark):
`Station | Northings | Eastings | Heights | Class of Beacon | Description`

**Datum Joins sheet columns:**
`From | To | ΔNorthing | ΔEasting | Distance | Bearing`

**Consistency Checks sheet columns:**
`Station | Computed N | Computed E | Plan N | Plan E | ΔN | ΔE | Status`

**Area Computations sheet columns:**
`Parcel | Area (m²) | Area (Ha) | F/R Area | Discrepancy | Status`

---

### Workstream 7 — Supporting Attachments

**File:** `src/lib/submission/checklist.ts`

```typescript
export interface AttachmentSlot {
  id: string
  label: string
  required: boolean
  accepts: string[]    // MIME types
  maxSizeMB: number
  helpText: string
}

export const BOUNDARY_ATTACHMENT_SLOTS: AttachmentSlot[] = [
  {
    id: 'ppa2',
    label: 'Physical Planning Approval (PPA2)',
    required: true,
    accepts: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMB: 10,
    helpText: 'Approval from local authority for subdivision',
  },
  {
    id: 'lcb_consent',
    label: 'Land Control Board Consent',
    required: true,
    accepts: ['application/pdf'],
    maxSizeMB: 10,
    helpText: 'Required for subdivisions under the Land Control Act',
  },
  {
    id: 'mutation_form',
    label: 'Mutation Form / Subdivision Scheme',
    required: true,
    accepts: ['application/pdf', 'image/jpeg'],
    maxSizeMB: 20,
    helpText: 'Signed by landowner and registered surveyor',
  },
  {
    id: 'rtk_raw',
    label: 'RTK Raw Output',
    required: false,
    accepts: ['.csv', '.txt', '.xlsx', '.rinex', '.obs'],
    maxSizeMB: 50,
    helpText: 'Raw GNSS field data from RTK session',
  },
  {
    id: 'field_book_export',
    label: 'Digital Field Book Export',
    required: false,
    accepts: ['.csv', '.fbk', '.xlsx', '.landxml'],
    maxSizeMB: 20,
    helpText: 'Exported from total station or GNSS instrument',
  },
]
```

---

### Workstream 8 — DWG Limitation Fix + GIS Export

**DWG import strategy** — add to the import page UI:

```tsx
// src/components/import/DWGImportGuidance.tsx
// Show this component when user uploads a .dwg file

export function DWGImportGuidance() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <h4 className="text-sm font-semibold text-amber-400 mb-1">
        DWG files cannot be opened directly
      </h4>
      <p className="text-xs text-zinc-400 mb-3">
        DWG is Autodesk's proprietary format. Convert to DXF first — it's free and takes 10 seconds:
      </p>
      <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
        <li>Open your DWG in AutoCAD, Civil 3D, or <a href="https://www.librecad.org" className="text-[#f59e0b] underline">LibreCAD (free)</a></li>
        <li>File → Save As → DXF 2018 format</li>
        <li>Upload the .dxf file here</li>
      </ol>
    </div>
  )
}
```

**Shapefile export** — `src/lib/export/generateShapefile.ts`

```typescript
// Use the 'shpjs' package for reading and 'shpwrite' for writing
// npm install shpwrite @types/shpwrite

import shpwrite from 'shpwrite'

export async function generateShapefileZip(
  beacons: BeaconData[],
  boundaries: BoundaryLine[],
  parcels: ParcelData[],
  submissionNumber: string,
  utmZone: number,
  hemisphere: 'N' | 'S'
): Promise<Blob> {
  const prjContent = getUTMPrj(utmZone, hemisphere)

  const pointsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: beacons.map(b => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [b.easting, b.northing] },
      properties: {
        STATION: b.id,
        CLASS: b.type,
        NORTHING: b.northing,
        EASTING: b.easting,
        HEIGHT: b.height ?? 0,
      }
    }))
  }

  const linesGeoJSON = {
    type: 'FeatureCollection' as const,
    features: boundaries.map(b => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [b.fromEasting, b.fromNorthing],
          [b.toEasting, b.toNorthing],
        ]
      },
      properties: {
        FROM: b.from,
        TO: b.to,
        BEARING: b.bearing,
        DISTANCE: b.distance,
      }
    }))
  }

  const options = {
    folder: submissionNumber,
    types: {
      point: `${submissionNumber}_Beacons`,
      polyline: `${submissionNumber}_BoundaryLines`,
      polygon: `${submissionNumber}_Parcels`,
    }
  }

  return shpwrite.download(
    { points: pointsGeoJSON, lines: linesGeoJSON },
    options
  )
}

function getUTMPrj(zone: number, hemisphere: 'N' | 'S'): string {
  const hemi = hemisphere === 'N' ? 'Northern' : 'Southern'
  return `PROJCS["WGS 84 / UTM zone ${zone}${hemisphere}",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${-183 + zone * 6}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",${hemisphere === 'S' ? 10000000 : 0}],UNIT["metre",1]]`
}
```

---

### Workstream 9 — Package Assembler

**File:** `src/lib/submission/assembleSubmission.ts`

```typescript
export interface PackageValidation {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

export function validateSubmissionPackage(
  submission: ProjectSubmission,
  project: MetarduProject,
  profile: SurveyorProfile | null
): PackageValidation {
  const blockers: string[] = []
  const warnings: string[] = []

  // Identity
  if (!profile) blockers.push('Surveyor profile not set — go to Account Settings')
  if (!profile?.registration_number) blockers.push('Registration number missing from surveyor profile')

  // Beacon data
  const bd = project.boundary_data as any
  if (!bd?.beacons?.length || bd.beacons.length < 3)
    blockers.push('At least 3 beacons required')

  // LR references
  if (!project.lr_number) blockers.push('LR Number not set on project')
  if (!project.folio_number) warnings.push('Folio number not set — required for Form No. 4')
  if (!project.register_number) warnings.push('Register number not set')

  // Required attachments
  if (!submission.supporting_attachments['ppa2'])
    blockers.push('Physical Planning Approval (PPA2) not uploaded')
  if (!submission.supporting_attachments['lcb_consent'])
    blockers.push('Land Control Board Consent not uploaded')

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  }
}
```

---

### New Project Fields Required

Add these to the `projects` table:

```sql
alter table projects
  add column if not exists lr_number text,
  add column if not exists folio_number text,
  add column if not exists register_number text,
  add column if not exists fir_number text,
  add column if not exists registration_block text,
  add column if not exists registration_district text,
  add column if not exists locality text,
  add column if not exists computations_no text,
  add column if not exists field_book_no text,
  add column if not exists file_reference text;
```

---

### Hard Rules

1. Every exported PDF — survey plan, report, workbook — must have the submission number in the header and footer before it leaves the system
2. `localStorage` must not be used for any field that appears on an official document
3. DWG import must show the conversion guidance component — never silently fail
4. Shapefile export must include `.prj` with the correct UTM WGS84 projection — a shapefile without `.prj` is rejected by most GIS systems
5. Deduplication (Workstream 10) must be done before adding any new UI to the project workspace
6. The `12√K mm` stale comment fix from Fix Brief 12.5 must be confirmed before Phase 13 closes

---

### Test Cases

1. Create project → generate submission number → confirm format `RS149_2025_001_R00`
2. Re-submit same project → confirm revision increments to `R01`, sequence stays `001`
3. Different project same surveyor same year → confirm sequence becomes `002`
4. Export survey plan PDF → confirm submission number appears in header and footer
5. Export shapefile ZIP → open in QGIS → confirm beacons plot correctly in UTM 37S
6. Upload a `.dwg` file → confirm DWG guidance component appears, file is rejected gracefully
7. Attempt to assemble package with missing PPA2 → confirm blocker message appears
8. Assemble complete package → confirm ZIP contains all 8 sections in benchmark order
9. Survey plan rendered → confirm coordinate table, LR numbers on parcels, inset diagram, and Form No. 4 title block all present
10. Remove all `localStorage` surveyor references → run build → confirm zero `localStorage.getItem('surveyor` occurrences in output
- Upload slots for supporting documents
- Real shapefile ZIP export
- Raw source-data package export

### Repetition problems causing delivery risk

- Duplicate workspace routes:
  - `src/app/project/[id]/page.tsx`
  - `src/app/project/[id]/workspace/page.tsx`
- Two report systems:
  - `src/lib/reports/surveyReport/index.ts`
  - `src/components/surveyreport/SurveyReportBuilder.tsx` plus `src/lib/compute/surveyReportSections.ts`
- Surveyor data stored in multiple places:
  - project fields
  - Supabase profile
  - localStorage on documents page
- Multiple export surfaces with overlapping responsibilities

## Phase Goal

Create a benchmark-aligned "Submission Package" system that:

- uses one canonical project submission model
- generates one coherent package in the same logical order as the benchmark
- preserves METARDU's automation advantage
- removes duplicated flows so future work lands in one place

## Non-Goals For This Phase

- Do not rebuild every drawing behavior from Civil 3D.
- Do not start by parsing DWG files deeply.
- Do not implement every country-specific document variation.
- Do not add more UI before unifying the underlying data model.

## Workstreams

## Workstream 1: Canonical Submission Domain Model

### Objective

Create one source of truth for submission-ready outputs.

### Deliverables

- New `project_submissions` table or equivalent structured JSON domain
- Stores:
  - project id
  - surveyor profile id
  - submission number
  - revision code
  - submission year
  - package status
  - required document checklist
  - generated artifact paths
  - supporting attachment paths
  - package validation results

### Suggested files

- `supabase/migrations/`
- `src/types/`
- `src/lib/supabase/`
- `src/lib/submission/`

### Acceptance criteria

- A project can have at least one persisted submission package record.
- Submission record can describe the full package without depending on localStorage.

## Workstream 2: Surveyor Identity Unification

### Objective

Stop using mixed surveyor sources.

### Current state

- Profile data exists in `surveyor_profiles`.
- Documents page still uses localStorage surveyor details.

### Deliverables

- Standard surveyor profile loader used by:
  - survey plan renderer
  - report generator
  - document package
  - submission assembler
- Add seal/signature asset support if not already present.
- Remove localStorage as primary source for official document identity.

### Suggested files

- `src/lib/supabase/community.ts`
- `src/app/project/[id]/documents/page.tsx`
- `src/lib/reports/surveyPlan/*`
- `src/lib/reports/surveyReport/*`

### Acceptance criteria

- Every official document can pull surveyor name, firm, registration, and optional seal from one persistent source.

## Workstream 3: Submission Numbering and Revision Policy

### Objective

Replace generic report numbers with a Kenya-style package identifier.

### Target format

- `[SurveyorRegNo]_[YYYY]_[###]_[R##]`

### Deliverables

- sequence generator per surveyor per year
- revision increment rules
- shared formatter used by all exported package artifacts

### Suggested files

- `src/lib/submission/numbering.ts`
- `src/lib/submission/types.ts`
- `src/lib/supabase/submissions.ts`
- migration for counters or sequence-safe generation

### Acceptance criteria

- New submission can generate a unique number
- Revisions update only the `R##` segment
- Same package number appears on all relevant outputs

## Workstream 4: Benchmark-Aligned Package Structure

### Objective

Mirror the benchmark order while keeping METARDU data-driven.

### Required package sections

1. Surveyor's report
2. Index to computations
3. Final coordinate list
4. Working diagram
5. Theoretical computations
6. RTK / field result bundle
7. Consistency checks
8. Area computations

### Deliverables

- package manifest generator
- section-specific generators fed from project data
- index sheet auto-built from manifest

### Suggested files

- `src/lib/submission/manifest.ts`
- `src/lib/submission/assembleSubmission.ts`
- `src/lib/reports/documentPackage.ts`
- `src/lib/reports/surveyReport/`
- `src/lib/reports/surveyPlan/`

### Acceptance criteria

- Package manifest outputs benchmark-aligned section order.
- Missing sections are explicitly flagged before export.

## Workstream 5: Working Diagram and Survey Plan Upgrade

### Objective

Improve official-sheet realism using the benchmark as the visual target.

### Current strength

- `src/lib/reports/surveyPlan/renderer.ts` already has many advanced pieces:
  - coordinate schedule
  - legend
  - north arrow
  - scale bar
  - revisions
  - legal references
  - title/footer blocks

### Remaining work

- Add benchmark-style multi-table density and placement refinement.
- Add formal title block fields that match office-issued sheets more closely:
  - folio
  - register number
  - form number
  - drawn/checked fields
  - submission number
- Ensure plotted output supports:
  - final coordinate list references
  - consistency check references
  - surveyor certification block
- Standardize working diagram vs final plan modes instead of maintaining separate ad hoc layouts.

### Suggested files

- `src/lib/reports/surveyPlan/renderer.ts`
- `src/lib/reports/surveyPlan/types.ts`
- `src/components/SurveyPlanViewer*`
- `src/components/SurveyPlanExport*`

### Acceptance criteria

- A generated sheet can visibly resemble the benchmark class of output, even if not identical to Civil 3D drafting.

## Workstream 6: Computation Book Generator

### Objective

Generate the benchmark workbook structure from project data.

### Required sheets

- Surveyor report
- Index to computations
- Final coordinate list
- Datum joins
- Consistency of datum
- Theoretical computations
- RTK result
- Consistency checks
- Areas

### Deliverables

- workbook export service
- stable ordering and sheet naming
- formulas or computed values for:
  - joins
  - delta northings/eastings
  - bearings
  - distances
  - consistency checks
  - area totals and discrepancy

### Suggested files

- `src/lib/submission/workbook/`
- `src/lib/compute/`
- `src/lib/export/`

### Acceptance criteria

- Generated workbook follows the benchmark section order.
- Coordinates, joins, and area checks can be traced back to project data.

## Workstream 7: Supporting Data and Attachments

### Objective

Support the non-drawing pieces required for a full submission.

### Deliverables

- attachment slots for:
  - physical planning approval
  - Land Control Board consent
  - mutation-related support files
  - RTK raw output or source files
  - field book exports
- attachment checklist in submission validation

### Suggested files

- project settings or documents UI
- `src/lib/submission/checklist.ts`
- `src/lib/submission/storage.ts`
- Supabase storage integration

### Acceptance criteria

- Submission package can tell the user exactly which supporting artifacts are missing.

## Workstream 8: GIS and Raw Data Export

### Objective

Close the last compliance gap around machine-readable deliverables.

### Deliverables

- real shapefile ZIP export:
  - `.shp`
  - `.shx`
  - `.dbf`
  - `.prj`
  - `.xml`
  - `.cpg`
- raw source data ZIP with folders like:
  - `GNSS Raw/`
  - `Digital Field Book/`
  - `Level Data/`

### Suggested files

- `src/lib/export/`
- `src/lib/submission/assembleSubmission.ts`

### Acceptance criteria

- User can download one machine-readable GIS package and one raw-source package from the same submission record.

## Workstream 9: Package Assembler and Validator

### Objective

Create the final "one-button" workflow.

### Deliverables

- validate submission completeness
- generate package manifest
- assemble all outputs
- produce downloadable ZIP or package bundle
- show errors in plain language

### Suggested files

- `src/lib/submission/assembleSubmission.ts`
- `src/lib/submission/validateSubmission.ts`
- `src/app/project/[id]/documents/page.tsx`
- or a dedicated `submission` page under the project

### Acceptance criteria

- User can click one action and get either:
  - a complete package
  - or a precise list of blockers

## Workstream 10: Remove Repetition Before More Features

### Objective

Reduce future maintenance cost and stop duplicating fixes.

### Required cleanup

- Choose one project workspace route as canonical.
- Move shared workspace logic into reusable modules.
- Choose one survey report engine as canonical.
- Route all official document identity through one surveyor-profile source.

### Suggested files

- `src/app/project/[id]/page.tsx`
- `src/app/project/[id]/workspace/page.tsx`
- `src/components/surveyreport/SurveyReportBuilder.tsx`
- `src/lib/reports/surveyReport/index.ts`
- `src/lib/compute/surveyReportSections.ts`

### Acceptance criteria

- Official package work lands in one route tree and one report system.

## Recommended Build Order

Build in this order. Do not skip the data model and cleanup steps.

1. Canonical submission domain model
2. Surveyor identity unification
3. Submission numbering and revision policy
4. Remove duplicate workspace/report pathways
5. Benchmark-aligned package manifest
6. Computation workbook generator
7. Working diagram and survey plan upgrade
8. Supporting attachments
9. GIS/raw export packages
10. Final package assembler and validator

## Suggested Milestones

### Milestone A: Foundation

- create submission model
- unify surveyor profile usage
- implement numbering

Exit when:

- package has persistent identity
- documents no longer depend on localStorage for official surveyor identity

### Milestone B: Package Skeleton

- create submission manifest
- add benchmark section order
- define validators for required artifacts

Exit when:

- package can be listed as complete/incomplete with explicit missing items

### Milestone C: Computation Book

- generate benchmark-style workbook sheets
- verify coordinate, joins, consistency, and area outputs

Exit when:

- workbook package order matches the benchmark

### Milestone D: Official Drawing Output

- improve working diagram/final plan sheet realism
- add folio/register/form/title-block fields

Exit when:

- official sheet output looks submission-grade

### Milestone E: Full Package

- attach supporting files
- add shapefile/raw data exports
- assemble final package

Exit when:

- one-click package generation works or clearly reports blockers

## Concrete Existing Code To Reuse

These are good starting points, not throwaway code:

- `src/lib/reports/surveyPlan/renderer.ts`
- `src/lib/reports/documentPackage.ts`
- `src/lib/reports/surveyReport/index.ts`
- `src/components/surveyreport/SurveyReportBuilder.tsx`
- `src/lib/compute/surveyReportSections.ts`
- `src/lib/reports/traverseAccuracy.ts`
- `src/lib/engine/leveling.ts`
- `src/lib/supabase/community.ts`

## High-Risk Areas

- Duplicating fixes into both workspace routes
- Building new UI before unifying data ownership
- Keeping localStorage surveyor identity in official document generation
- Implementing shapefile export before the package manifest exists
- Letting survey report logic stay split across incompatible systems

## Open Questions To Resolve With The User

- Exact official numbering authority for submission number seed
- Whether seal image must be embedded or only a placeholder block is acceptable
- Whether RTK result should be imported raw or attached as external vendor output
- Whether the final package must be one ZIP or multiple named downloads
- Whether benchmark workbook naming should be copied exactly or normalized

## If Interrupted: Resume Protocol

When another agent picks this up, do this first:

1. Read this file completely.
2. Confirm which workspace route is currently intended as canonical:
   - `src/app/project/[id]/page.tsx`
   - `src/app/project/[id]/workspace/page.tsx`
3. Inspect current uncommitted changes before editing anything.
4. Start from Milestone A unless the repo already contains a submission domain layer.
5. Avoid touching shapefile export until numbering, manifest, and identity are unified.

## First Implementation Task For The Next Agent

The next agent should not start with UI polish.
The first task should be:

- create `submission` types and storage helpers
- map one project to one persistent submission record
- replace localStorage surveyor details in the documents flow with profile-backed data

That unlocks every later feature without multiplying rework.
Good. I can see the benchmark image clearly — that's Form No. 4, Folio 583, Register 58, Scale 1:3000. Let me study it and the Phase 13 plan together, then write the brief.

**What the benchmark image tells me that the Phase 13 plan didn't fully capture:**

The real Kenyan survey plan has a very specific layout:
- Two large coordinate tables top-left and top-right with columns: Station / Northings / Eastings / Heights / Class of Beacon
- "Theoretical" and "I.P.C.U." beacon class annotations inline in the table
- Dense bearing/distance callouts directly on every boundary line
- LR numbers on every parcel
- An inset at 1:1000 scale for the complex corner detail (top right and bottom left)
- The title block at the bottom has: Registration date, File Reference, Computations No., Field Book No., Provisional/Final Approval, Authentication columns
- Bottom: Folio No. and Register No. as large standalone text
- Surveyor's declaration bottom-left with stamp/seal area
- "All new roads are 12.00m wide / All road truncations ±6mm" notes embedded in the drawing

**On the DWG limitation:** DWG is Autodesk's proprietary binary format. You cannot parse it in a browser or Node.js without a commercial SDK (Open Design Alliance costs ~$10k/year). The practical fix is:

1. **Import side** — accept DXF only (which AutoCAD/Civil 3D can export for free). Add a DWG→DXF conversion note in the UI.
2. **Export side** — Metardu already exports DXF. Keep it. DXF opens in AutoCAD, Civil 3D, QGIS, and LibreCAD.
3. **For users with DWG files** — add a one-click instruction in the UI: *"Open in AutoCAD → Save As → DXF 2018 → Upload here"*

Now the brief:

---

## Phase 13 Brief — Submission Package

**Objective:** Turn Metardu into a benchmark-aligned Kenya submission workflow. One project → one submission record → one complete package.

**Benchmark target:** Form No. 4 survey plan as seen in `583_58(1).jpg` — dense office-issued sheet with coordinate tables, LR annotations, inset diagrams, and formal title block.

---

### Workstream 1 — Canonical Submission Domain Model

**File:** `supabase/migrations/[timestamp]_create_project_submissions.sql`

```sql
create table project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  surveyor_profile_id uuid references surveyor_profiles(id),
  submission_number text not null,
  revision_code text not null default 'R00',
  submission_year integer not null,
  package_status text not null default 'draft'
    check (package_status in ('draft','incomplete','ready','submitted')),
  required_sections jsonb not null default '[]',
  generated_artifacts jsonb not null default '{}',
  supporting_attachments jsonb not null default '{}',
  validation_results jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table project_submissions enable row level security;

create policy "owner access" on project_submissions
  for all using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create table submission_sequence (
  surveyor_profile_id uuid not null references surveyor_profiles(id),
  year integer not null,
  last_sequence integer not null default 0,
  primary key (surveyor_profile_id, year)
);

alter table submission_sequence enable row level security;

create policy "owner access" on submission_sequence
  for all using (
    surveyor_profile_id in (
      select id from surveyor_profiles where user_id = auth.uid()
    )
  );
```

**File:** `src/types/submission.ts`

```typescript
export interface ProjectSubmission {
  id: string
  project_id: string
  surveyor_profile_id: string
  submission_number: string      // e.g. "RS149_2025_002_R00"
  revision_code: string          // "R00", "R01", etc.
  submission_year: number
  package_status: 'draft' | 'incomplete' | 'ready' | 'submitted'
  required_sections: SubmissionSection[]
  generated_artifacts: Record<string, string>   // section_id → storage path
  supporting_attachments: Record<string, string> // slot_id → storage path
  validation_results: ValidationResult[]
  created_at: string
  updated_at: string
}

export interface SubmissionSection {
  id: string
  order: number
  label: string
  required: boolean
  status: 'missing' | 'pending' | 'ready'
  artifact_key?: string
}

export interface ValidationResult {
  section_id: string
  passed: boolean
  message: string
}

// Benchmark-aligned section order (matches 5 acres compilation + 4 acres theoretical)
export const SUBMISSION_SECTIONS: SubmissionSection[] = [
  { id: 'surveyor_report',       order: 1, label: "Surveyor's Report",          required: true,  status: 'missing' },
  { id: 'index',                 order: 2, label: 'Index to Computations',       required: true,  status: 'missing' },
  { id: 'coordinate_list',       order: 3, label: 'Final Coordinate List',       required: true,  status: 'missing' },
  { id: 'working_diagram',       order: 4, label: 'Working Diagram',             required: true,  status: 'missing' },
  { id: 'theoretical_comps',     order: 5, label: 'Theoretical Computations',    required: true,  status: 'missing' },
  { id: 'rtk_result',            order: 6, label: 'RTK / Field Result Bundle',   required: false, status: 'missing' },
  { id: 'consistency_checks',    order: 7, label: 'Consistency Checks',          required: true,  status: 'missing' },
  { id: 'area_computations',     order: 8, label: 'Area Computations',           required: true,  status: 'missing' },
]
```

---

### Workstream 2 — Surveyor Identity Unification

**File:** `src/lib/submission/surveyorProfile.ts`

```typescript
import { createClient } from '@/lib/supabase/client'

export interface SurveyorProfile {
  id: string
  user_id: string
  full_name: string
  registration_number: string   // e.g. "RS149" — used in submission number
  firm_name?: string
  seal_url?: string             // Supabase storage path to seal image
  signature_url?: string
}

export async function getActiveSurveyorProfile(): Promise<SurveyorProfile | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await supabase
    .from('surveyor_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle()

  return data as SurveyorProfile | null
}
```

**Hard rule:** Remove all `localStorage.getItem('surveyorName')` / `localStorage.getItem('registrationNo')` references from `src/app/project/[id]/documents/page.tsx` and replace with `getActiveSurveyorProfile()`. Every official document must source identity from this function only.

---

### Workstream 3 — Submission Numbering

**File:** `src/lib/submission/numbering.ts`

```typescript
import { createClient } from '@/lib/supabase/client'

export async function generateSubmissionNumber(
  surveyorProfileId: string,
  registrationNo: string
): Promise<{ submissionNumber: string; sequence: number; year: number }> {
  const supabase = createClient()
  const year = new Date().getFullYear()

  // Atomically increment sequence
  const { data, error } = await supabase.rpc('increment_submission_sequence', {
    p_surveyor_profile_id: surveyorProfileId,
    p_year: year,
  })

  if (error) throw error
  const seq = data as number

  const submissionNumber = `${registrationNo}_${year}_${String(seq).padStart(3, '0')}_R00`
  return { submissionNumber, sequence: seq, year }
}

export function incrementRevision(submissionNumber: string): string {
  // RS149_2025_002_R00 → RS149_2025_002_R01
  const parts = submissionNumber.split('_')
  const revPart = parts[parts.length - 1]
  const revNum = parseInt(revPart.replace('R', ''), 10)
  parts[parts.length - 1] = `R${String(revNum + 1).padStart(2, '0')}`
  return parts.join('_')
}
```

**Supabase function** (add to a new migration):

```sql
create or replace function increment_submission_sequence(
  p_surveyor_profile_id uuid,
  p_year integer
) returns integer language plpgsql security definer as $$
declare
  v_seq integer;
begin
  insert into submission_sequence (surveyor_profile_id, year, last_sequence)
  values (p_surveyor_profile_id, p_year, 1)
  on conflict (surveyor_profile_id, year)
  do update set last_sequence = submission_sequence.last_sequence + 1
  returning last_sequence into v_seq;
  return v_seq;
end;
$$;
```

---

### Workstream 4 — Workstream 10 (Deduplication) — Do This Before Building Anything Else

**Decision to make in code — canonical workspace route is:**
`src/app/project/[id]/page.tsx`

Delete or redirect `src/app/project/[id]/workspace/page.tsx` to the above.

**Decision — canonical report engine is:**
`src/lib/reports/surveyReport/index.ts`

Delete `src/lib/compute/surveyReportSections.ts` after migrating any unique logic into the canonical engine.

---

### Workstream 5 — Survey Plan Upgrade to Form No. 4 Standard

This is the most visible gap. The benchmark image shows exactly what's needed.

**File:** `src/lib/reports/surveyPlan/types.ts` — add these fields:

```typescript
export interface SurveyPlanTitleBlock {
  // Existing fields kept
  projectTitle: string
  clientName: string
  surveyorName: string
  registrationNumber: string
  firmName?: string
  sealImageUrl?: string

  // New fields from Form No. 4 benchmark
  folioNumber: string           // "583" — from Land Registry
  registerNumber: string        // "58"
  lrNumber: string              // "LR No. 7185/59-65"
  plotParcelNumber: string
  refMapRIM: string             // "R.I.M N.A 36/9-14-3..."
  registrationBlock: string
  registrationDistrict: string
  locality: string
  formNumber: string            // "Form No. 4"
  computationsNo: string
  fieldBookNo: string
  dateReceived: string
  fileReference: string
  scale: string                 // "1:3000"

  // Authentication block
  examinedBy: string
  examinedDate: string
  approvedBy: string
  approvedDate: string
  authenticatedBy: string
  authenticatedDate: string

  // Surveyor declaration
  declarationText: string
  surveyorSignatureUrl?: string
  declarationDate: string
  letterNo: string              // "ISK/FPS/25/46/XI/105"
}

export interface CoordinateScheduleEntry {
  station: string
  northing: number
  easting: number
  height?: number
  beaconClass: 'new' | 'old' | 'theoretical' | 'I.P.C.U.'
  description?: string
}

export interface InsetDiagram {
  scale: string                 // "1:1000"
  beacons: string[]             // beacon IDs included in inset
  position: 'top-right' | 'bottom-left'
  labelText: string             // "INSET SCALE 1:1000"
  notToScale: boolean
}
```

**File:** `src/lib/reports/surveyPlan/renderer.ts` — add these rendering rules on top of existing renderer:

```typescript
// RULE 1: Coordinate tables
// Split beacons into two tables: left side (P-series, K-series) and right side (N-series, D-series)
// Each table: Station | Northings | Eastings | Heights | Class of Beacon
// "Theoretical" and "I.P.C.U." appear as inline text in the Class column, not icons

// RULE 2: Inset diagrams
// Any complex corner or road truncation area must render as a separate inset at higher scale
// Label as "INSET SCALE 1:1000" with "INSET NOT TO SCALE" if schematic

// RULE 3: Road annotations
// Add note text: "All new roads are 12.00m Wide"
// Add note text: "All road truncations ±6mm"
// These appear as callout text on the drawing, not in the title block

// RULE 4: LR numbers on parcels
// Every parcel polygon must display its LR number as text
// Format: "LR No. 7185/59" with area below: "A=co=03.311.0 Ha"
// Add "D.P No. A72482" reference where applicable

// RULE 5: Submission number in header and footer
// Submission number (e.g. RS149_2025_002_R00) must appear in header and footer of every sheet

// RULE 6: Grid lines
// Eastings and Northings grid lines with coordinate values on margins
// Format: "114300", "114400" etc. as margin labels

// RULE 7: Title block bottom of sheet
// Registration | Transaction | Authentication | Date | Records | Date
// All six columns rendered as a table spanning full sheet width
// Below table: "Folio No. ___" and "Register No. ___" as large standalone text
// FIR No. appears below Register No.
```

---

### Workstream 6 — Computation Workbook Generator

**File:** `src/lib/submission/workbook/generateWorkbook.ts`

```typescript
import * as XLSX from 'xlsx'

export function generateSubmissionWorkbook(data: SubmissionWorkbookData): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  // Sheet order matches benchmark exactly
  addSurveyorReportSheet(wb, data)
  addIndexSheet(wb, data)
  addCoordinateListSheet(wb, data)
  addDatumJoinsSheet(wb, data)
  addConsistencyOfDatumSheet(wb, data)
  addTheoreticalComputationsSheet(wb, data)
  if (data.rtkResults) addRTKResultSheet(wb, data)
  addConsistencyChecksSheet(wb, data)
  addAreaComputationsSheet(wb, data)

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
```

**Coordinate List sheet columns** (from benchmark):
`Station | Northings | Eastings | Heights | Class of Beacon | Description`

**Datum Joins sheet columns:**
`From | To | ΔNorthing | ΔEasting | Distance | Bearing`

**Consistency Checks sheet columns:**
`Station | Computed N | Computed E | Plan N | Plan E | ΔN | ΔE | Status`

**Area Computations sheet columns:**
`Parcel | Area (m²) | Area (Ha) | F/R Area | Discrepancy | Status`

---

### Workstream 7 — Supporting Attachments

**File:** `src/lib/submission/checklist.ts`

```typescript
export interface AttachmentSlot {
  id: string
  label: string
  required: boolean
  accepts: string[]    // MIME types
  maxSizeMB: number
  helpText: string
}

export const BOUNDARY_ATTACHMENT_SLOTS: AttachmentSlot[] = [
  {
    id: 'ppa2',
    label: 'Physical Planning Approval (PPA2)',
    required: true,
    accepts: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMB: 10,
    helpText: 'Approval from local authority for subdivision',
  },
  {
    id: 'lcb_consent',
    label: 'Land Control Board Consent',
    required: true,
    accepts: ['application/pdf'],
    maxSizeMB: 10,
    helpText: 'Required for subdivisions under the Land Control Act',
  },
  {
    id: 'mutation_form',
    label: 'Mutation Form / Subdivision Scheme',
    required: true,
    accepts: ['application/pdf', 'image/jpeg'],
    maxSizeMB: 20,
    helpText: 'Signed by landowner and registered surveyor',
  },
  {
    id: 'rtk_raw',
    label: 'RTK Raw Output',
    required: false,
    accepts: ['.csv', '.txt', '.xlsx', '.rinex', '.obs'],
    maxSizeMB: 50,
    helpText: 'Raw GNSS field data from RTK session',
  },
  {
    id: 'field_book_export',
    label: 'Digital Field Book Export',
    required: false,
    accepts: ['.csv', '.fbk', '.xlsx', '.landxml'],
    maxSizeMB: 20,
    helpText: 'Exported from total station or GNSS instrument',
  },
]
```

---

### Workstream 8 — DWG Limitation Fix + GIS Export

**DWG import strategy** — add to the import page UI:

```tsx
// src/components/import/DWGImportGuidance.tsx
// Show this component when user uploads a .dwg file

export function DWGImportGuidance() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <h4 className="text-sm font-semibold text-amber-400 mb-1">
        DWG files cannot be opened directly
      </h4>
      <p className="text-xs text-zinc-400 mb-3">
        DWG is Autodesk's proprietary format. Convert to DXF first — it's free and takes 10 seconds:
      </p>
      <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
        <li>Open your DWG in AutoCAD, Civil 3D, or <a href="https://www.librecad.org" className="text-[#f59e0b] underline">LibreCAD (free)</a></li>
        <li>File → Save As → DXF 2018 format</li>
        <li>Upload the .dxf file here</li>
      </ol>
    </div>
  )
}
```

**Shapefile export** — `src/lib/export/generateShapefile.ts`

```typescript
// Use the 'shpjs' package for reading and 'shpwrite' for writing
// npm install shpwrite @types/shpwrite

import shpwrite from 'shpwrite'

export async function generateShapefileZip(
  beacons: BeaconData[],
  boundaries: BoundaryLine[],
  parcels: ParcelData[],
  submissionNumber: string,
  utmZone: number,
  hemisphere: 'N' | 'S'
): Promise<Blob> {
  const prjContent = getUTMPrj(utmZone, hemisphere)

  const pointsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: beacons.map(b => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [b.easting, b.northing] },
      properties: {
        STATION: b.id,
        CLASS: b.type,
        NORTHING: b.northing,
        EASTING: b.easting,
        HEIGHT: b.height ?? 0,
      }
    }))
  }

  const linesGeoJSON = {
    type: 'FeatureCollection' as const,
    features: boundaries.map(b => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [b.fromEasting, b.fromNorthing],
          [b.toEasting, b.toNorthing],
        ]
      },
      properties: {
        FROM: b.from,
        TO: b.to,
        BEARING: b.bearing,
        DISTANCE: b.distance,
      }
    }))
  }

  const options = {
    folder: submissionNumber,
    types: {
      point: `${submissionNumber}_Beacons`,
      polyline: `${submissionNumber}_BoundaryLines`,
      polygon: `${submissionNumber}_Parcels`,
    }
  }

  return shpwrite.download(
    { points: pointsGeoJSON, lines: linesGeoJSON },
    options
  )
}

function getUTMPrj(zone: number, hemisphere: 'N' | 'S'): string {
  const hemi = hemisphere === 'N' ? 'Northern' : 'Southern'
  return `PROJCS["WGS 84 / UTM zone ${zone}${hemisphere}",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${-183 + zone * 6}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",${hemisphere === 'S' ? 10000000 : 0}],UNIT["metre",1]]`
}
```

---

### Workstream 9 — Package Assembler

**File:** `src/lib/submission/assembleSubmission.ts`

```typescript
export interface PackageValidation {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

export function validateSubmissionPackage(
  submission: ProjectSubmission,
  project: MetarduProject,
  profile: SurveyorProfile | null
): PackageValidation {
  const blockers: string[] = []
  const warnings: string[] = []

  // Identity
  if (!profile) blockers.push('Surveyor profile not set — go to Account Settings')
  if (!profile?.registration_number) blockers.push('Registration number missing from surveyor profile')

  // Beacon data
  const bd = project.boundary_data as any
  if (!bd?.beacons?.length || bd.beacons.length < 3)
    blockers.push('At least 3 beacons required')

  // LR references
  if (!project.lr_number) blockers.push('LR Number not set on project')
  if (!project.folio_number) warnings.push('Folio number not set — required for Form No. 4')
  if (!project.register_number) warnings.push('Register number not set')

  // Required attachments
  if (!submission.supporting_attachments['ppa2'])
    blockers.push('Physical Planning Approval (PPA2) not uploaded')
  if (!submission.supporting_attachments['lcb_consent'])
    blockers.push('Land Control Board Consent not uploaded')

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  }
}
```

---

### New Project Fields Required

Add these to the `projects` table:

```sql
alter table projects
  add column if not exists lr_number text,
  add column if not exists folio_number text,
  add column if not exists register_number text,
  add column if not exists fir_number text,
  add column if not exists registration_block text,
  add column if not exists registration_district text,
  add column if not exists locality text,
  add column if not exists computations_no text,
  add column if not exists field_book_no text,
  add column if not exists file_reference text;
```

---

### Hard Rules

1. Every exported PDF — survey plan, report, workbook — must have the submission number in the header and footer before it leaves the system
2. `localStorage` must not be used for any field that appears on an official document
3. DWG import must show the conversion guidance component — never silently fail
4. Shapefile export must include `.prj` with the correct UTM WGS84 projection — a shapefile without `.prj` is rejected by most GIS systems
5. Deduplication (Workstream 10) must be done before adding any new UI to the project workspace
6. The `12√K mm` stale comment fix from Fix Brief 12.5 must be confirmed before Phase 13 closes

---

### Test Cases

1. Create project → generate submission number → confirm format `RS149_2025_001_R00`
2. Re-submit same project → confirm revision increments to `R01`, sequence stays `001`
3. Different project same surveyor same year → confirm sequence becomes `002`
4. Export survey plan PDF → confirm submission number appears in header and footer
5. Export shapefile ZIP → open in QGIS → confirm beacons plot correctly in UTM 37S
6. Upload a `.dwg` file → confirm DWG guidance component appears, file is rejected gracefully
7. Attempt to assemble package with missing PPA2 → confirm blocker message appears
8. Assemble complete package → confirm ZIP contains all 8 sections in benchmark order
9. Survey plan rendered → confirm coordinate table, LR numbers on parcels, inset diagram, and Form No. 4 title block all present
10. Remove all `localStorage` surveyor references → run build → confirm zero `localStorage.getItem('surveyor` occurrences in output