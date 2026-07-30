# Cadastral & Engineering Survey Map Output — Kenya Standards Benchmark

**Date:** 2026-07-07
**Audience:** Geomatics engineers doing cadastral, topographic, and engineering surveys in Kenya/East Africa.
**Context:** This supersedes the general topographic benchmarks document. It covers only Kenya-specific cadastral and engineering survey output standards.

---

## 0. What Standards Apply in Kenya

### Primary Legislation & Regulation
| Document | Authority | What it Governs |
|---|---|---|
| **Survey Act Cap. 299** | GoK / Survey of Kenya | All land surveying in Kenya. Defines who may survey, what documents required, authentication process |
| **Survey Regulations 1994** | Survey of Kenya | Field procedures, equipment, accuracy tolerances, submission formats |
| **RDM 1.1 (2025)** | Survey of Kenya | Reference Data Manual — accuracy specifications, Tables 5.1–5.4, control tolerances, symbol standards |
| **SRVY2025-1** | Survey of Kenya | 2025 survey regulations — new submission numbering, digital requirements, NLIMS integration |
| **Registered Land Act (RLA) Cap. 300** | GoK | Land registration, mutation procedures, registry index maps |
| **Land Act No. 6 of 2012** | GoK | Land administration, easements, adverse possession |

### Digital Submission
| System | Authority | Purpose |
|---|---|---|
| **NLIMS** (National Land Information Management System) | Ministry of Lands | Digital land registration — all submissions go through here |
| **ArdhiSasa** (landservice.go.ke) | Ministry of Lands | Public-facing land services portal, backed by NLIMS |

### What Does NOT Apply Here
- **OpenTopoMap** — German hiking map styling (relevance: low — different purpose, different audience)
- **USGS topographic quadrangles** — US federal mapping standard (relevance: low — different country, different datum, different legal framework)
- **British OS MasterMap** — UK property mapping (relevance: medium — some conventions carry over but Kenya has its own symbol standards)
- **FAO land cover classifications** — not survey mapping

---

## 1. Cadastral Survey — Form No. 4 (Deed Plan)

### 1.1 What is Form No. 4

Form No. 4 is the **primary cadastral map output** in Kenya. It is a survey plan showing:
- Parcel boundary with bearings and distances on each leg
- All boundary beacons (type, status, description, coordinates)
- Computed area (ground area, not grid area)
- North arrow, scale bar, title block
- Abuttal descriptions (what adjoins each side of the parcel)
- Surveyor declaration block
- Submission number (SRVY2025-1 format)

### 1.2 Legal Framework
- **Survey Act Cap. 299 Section 13** — every first registration requires a survey plan
- **Survey Regulations 1994 Regulation 36** — plan must show beacons, bearings, distances, area
- **RDM 1.1 Section 5** — accuracy classifications and symbol standards
- **SRVY2025-1** — digital submission numbering and NLIMS export format

### 1.3 Required Content per Kenya Regulations

#### 1.3.1 Header Block (title block)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [SURVEYOR NAME]                                   Survey No: [SRVY2025-1 No.] │
│  ISK No: [ISK-XXXX]                               Drawing No: [FR/LR No.]       │
│  [FIRM NAME]                                       LR/Parcel No: [LR No.]       │
│  [FIRM ADDRESS]                                    Registration Section: [.]    │
│                                                     Sheet: [N] of [total]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**SRVY2025-1 Submission Number Format:**
```
[SurveyorRegistrationNo]_[YYYY]_[###]_[R##]
Example: RS149_2025_002_R01
```
- SurveyorRegistrationNo: RS + ISK number (e.g., RS149)
- YYYY: year
- ###: sequential submission number (001-999)
- R##: revision number (R00, R01, ...)

#### 1.3.2 Parcel Boundary
- Each boundary leg annotated with **bearing (WCB, degrees-minutes-seconds)** and **distance (metres to 2dp)**
- Bearings in **Whole Circle Bearing format** (0°–360°)
- Beacon symbols at each corner per SoK symbol standard
- Boundary line weight: **0.3mm solid black** (RDM 1.1 symbol standard)
- Parcel shading: none (unshaded for official submission)

#### 1.3.3 Beacon Schedule (mandatory table)
| Beacon | Easting (m) | Northing (m) | Elevation (m) | Type | Status | Description |
|---|---|---|---|---|---|---|
| AB1 | 4332.60 | 114190.94 | 1825.30 | Concrete Beacon | SET | IPC NEW |
| AB2 | 4259.00 | 114198.58 | 1824.90 | Concrete Beacon | SET | IPC NEW |

**Beacon Types per SoK/RDM 1.1:**
- `PSC` — Primary Survey Control (concrete pillar)
- `PSC_FLUSH` — PSC flush with ground
- `SSC` — Secondary Survey Control
- `TSC` — Tertiary Survey Control
- `CONCRETE_BEACON` — Concrete boundary beacon
- `IRON_PIN` — Iron pin driven in ground
- `MASONRY_NAIL` — Nail in masonry/concrete
- `WOODEN_PEG` — Temporary peg (use only where specified)
- `INDICATORY` — Indicatory beacon (not at actual corner)
- `RIVET` — Brass/steel rivet in rock or concrete
- `BM` — Benchmark (permanent elevation control)
- `TBM` — Temporary Benchmark
- `ROAD_NAIL` — Nail in tarmac
- `FENCE_POST` — Fence post at boundary
- `WALL_CORNER` — Corner of permanent wall

**Beacon Status:**
- `FOUND` — beacon physically found and verified
- `SET` — beacon placed during this survey
- `REFERENCED` — beacon referenced from another mark
- `DESTROYED` — beacon no longer present
- `NOT_FOUND` — searched but not found

#### 1.3.4 Area Statement
```
Area = [computed ground area] Ha (hectares)
     = [computed ground area] acres (imperial reference)
Grid Area = [grid area] m² (for comparison)
Scale Factor applied = [SF]
```

**Important:** Deed plan must show **ground area**, not grid area. If UTM coordinates are used, apply scale factor correction.

#### 1.3.5 Abuttals (mandatory on all four sides)
```
North: [registered landowner or feature — e.g., "Remainder of LR No. 1234"]
South: [e.g., "Access road reserve — 30m wide"]
East:  [e.g., "Neighbouring holding — LR No. 5678"]
West:  [e.g., "Mlolongo river reserve — 10m wide"]
```

#### 1.3.6 North Arrow & Scale Bar
- North arrow: True North with **N** label (not magnetic — state magnetic declination if shown)
- Scale bar: RF 1:[scale] with graphic bar showing **metre divisions** (e.g., 0, 10, 20, 30m)
- Always show both RF notation AND graphic scale

#### 1.3.7 Surveyor Declaration Block (mandatory)
```
I, [Full Name], Registered Surveyor No. [ISK-XXXX], certify that the
boundary pegs described herein were placed under my supervision in
accordance with the Survey Regulations 1994 and the Survey Act Cap. 299.

Signature: ___________________________  Date: __________________

Surveyor Registration No.: ___________  ISK No.: ___________
```

#### 1.3.8 Coordinate Reference Block
```
Datum: Arc 1960 (EPSG:21037)  Projection: UTM Zone 37S
Reduction: Grid to Ground applied (SF = 0.99979)
Mean elevation: [Z]m above sea level
```

### 1.4 METARDU Current Status — Form No. 4

**What exists:**
- `DeedPlanGenerator.tsx` — UI for generating deed plans
- `FormNo4Preview.tsx` — renders parcel boundary on canvas with beacons
- `DeedPlanInput` type covers most required fields
- Beacon types align with SoK standard (PSC, SSC, TSC, etc.)
- Survey number format partially supported
- `audit-13.md` print header format is partially implemented

**Gaps identified:**
| Item | Required by | METARDU Status |
|---|---|---|
| SRVY2025-1 submission number field | SRVY2025-1 | ❌ Not in input form |
| Grid-to-ground area correction (scale factor) | Survey Regs 1994, RDM 1.1 | ⚠️ `scale-factor` tool exists but not in deed plan flow |
| Sheet numbering (N of total) | Survey Regs 1994 | ❌ Not implemented |
| Surveyor declaration block (wet signature placeholder) | Survey Act Cap. 299 | ⚠️ Partial — signature line exists but not the full declaration text |
| Abuttal table (N/S/E/W) | Survey Regulations 1994 Reg. 36 | ✅ Implemented |
| Beacon elevation in schedule | Survey Regs 1994 | ⚠️ Elevation field exists but not consistently shown in output |
| Coordinate reference block (datum, projection, SF) | RDM 1.1 | ❌ Not in deed plan output |
| LR/Parcel number in header | NLIMS | ✅ In input |
| Drawing number field | NLIMS | ✅ In input |
| Registry Map Sheet reference | NLIMS | ⚠️ `registryMapSheet` field exists in type but not on form |
| Auditor/Checked By field | SRVY2025-1, internal QC | ✅ `checkedBy` exists |
| Ground area vs grid area distinction | RDM 1.1 | ⚠️ `area` field exists but no distinction between ground/grid |
| FIR number field | NLIMS (first registration) | ✅ In input (as `firNumber`) |

---

## 2. Engineering Survey Plans

### 2.1 What Constitutes an Engineering Survey Plan in Kenya

An engineering survey plan in Kenya typically includes:

**For cadastral-related engineering (subdivision, site plans):**
- Site location plan (Kenya map inset showing county/location)
- Feature map (existing features: buildings, roads, fences, trees, water bodies)
- Grading plan (cut/fill areas, bench levels)
- Services layout (drainage, water, power, telecoms)
- Setting-out data plan

**For road/infrastructure engineering surveys:**
- Horizontal alignment plan
- Vertical alignment (longitudinal section)
- Cross-sections at specified intervals (20m per RDM 1.1 Section 5.6.2)
- Right-of-way boundaries
- Utility crossings
- Earthworks quantification

### 2.2 Legal Framework
- **Survey Regulations 1994** — all surveys must be conducted by or under supervision of a registered surveyor
- **RDM 1.1** — accuracy standards, cross-section intervals, tolerance tables
- **Public Roads Act** — for road surveys, right-of-way requirements
- **Physical Planning Act** — development permission survey plans must accompany applications
- **Environmental Management and Coordination Act** — for environmental impact surveys

### 2.3 Required Content per Kenya Engineering Survey Standards

#### 2.3.1 Control Network Annotation
Every engineering survey plan must show:
```
Horizontal Control: [Class] — [Method] — [Date]
Vertical Control: [BM used] — [RL of BM] — [Description]
All coordinates relative to: Arc 1960 / UTM Zone 37S
```

**RDM 1.1 accuracy classes:**
| Class | Traverse precision | Leveling closure |
|---|---|---|
| First Order | 1:50,000 | ±2mm√K |
| Second Order | 1:20,000 | ±5mm√K |
| Third Order | 1:10,000 | ±10mm√K |
| Fourth Order | 1:5,000 | ±20mm√K |

#### 2.3.2 Feature Map Requirements
For a typical engineering/topographic survey plan:

| Feature Type | Line Weight | Annotation |
|---|---|---|
| Main building (permanent) | 0.5mm solid black | Building material, floor level |
| Subsidiary building | 0.3mm solid black | — |
| Fence (permanent) | 0.3mm solid | Fence type (chain-link, barbed wire, wall) |
| Existing boundary (registered) | 0.5mm solid | LR number of adjoining parcel |
| Road edge (bitumen) | 0.5mm solid black | Road classification, width |
| Access path | 0.3mm dashed | — |
| Water course | 0.5mm blue | Perennial/intermittent, HWM marked |
| Contour lines | 0.3mm brown (dashed), 0.6mm brown (index) | Elevation in metres |
| Spot level | Point symbol + annotation | Elevation to 2dp |
| Tree (significant) | Symbol + species name | Trunk diameter at breast height |

#### 2.3.3 Cross-Section Format (RDM 1.1 Section 5.6.2)
```
Chainage | CL RL | L1_off | L1_RL | L2_off | L2_RL | ... | R1_off | R1_RL | ...
   0+000  | 1825.30|  -3.0 |1824.20|  -6.0 |1823.50|     |  +3.0 |1824.50
   0+020  | 1825.10|  -2.8 |1824.15|  -5.5 |1823.40|     |  +3.2 |1824.60
```

- **Standard interval:** 20m for roads, 20m for site grids (RDM 1.1 Section 5.6.2)
- **Extra levels:** At change of gradient, road junctions, drainage structures, top/bottom of cuts/fills
- **Cut/fill annotation:** Volume in cubic metres between sections

#### 2.3.4 Setting-Out Data Table (required for construction surveys)
| Point | Chainage | Offset (m) | Bearing | Distance (m) | RL/TLevel | Remarks |
|---|---|---|---|---|---|---|
| TL1 | 0+000 | 0 | — | — | 1825.30 | Start of curve |
| BC | 0+020 | 0 | 000°00'00" | 20.00 | 1824.50 | Beginning of curve |

#### 2.3.5 Earthworks Summary (mandatory for subdivisions)
```
Total Cut:      [m³]
Total Fill:     [m³]
Net:            [m³] (Cut – Fill)
Balance factor: [.]% (should be within 2% for well-designed cut/fill)
Top soil strip:  [m³] (assumed 150mm depth)
```

#### 2.3.6 Location Diagram (required for subdivision plans)
Kenya outline map showing:
- County boundary highlighted
- Specific location marked with arrow
- Scale bar on inset
- Title: "LOCATION PLAN — [County] County"

### 2.4 METARDU Current Status — Engineering Survey Plans

**What exists:**
- `CrossSectionInput.tsx` — cross-section data capture with chainage, CL RL, offsets, left/right levels
- `EarthworksCalculator.tsx` — cut/fill volume computation (end-area method)
- `RoadDesignTool.tsx` / `crossSections/[id]/page.tsx` — road horizontal/vertical curve design
- `topoPlanRenderer.tsx` — topographic plan with contours, spot heights, control points, boundary
- `measurement/area/page.tsx` — area computation with cut/fill heat map
- `drainage/Design.tsx` — drainage gradient design using Manning's equation

**Gaps identified:**
| Item | Required by | METARDU Status |
|---|---|---|
| Control network annotation block on plan | RDM 1.1 | ❌ Not in topo renderer |
| Feature classification by line weight (building vs fence vs road) | Survey Regs 1994 | ❌ All features rendered with same weight |
| Location diagram (Kenya map inset) | Survey Regs 1994 | ⚠️ Mentioned in topo renderer header but not implemented |
| Cut/fill annotation on cross-sections | RDM 1.1 Section 5.6.2 | ❌ Cut/fill values not shown in section output |
| Right-of-way boundary lines (e.g., 30m from road centerline) | Public Roads Act | ❌ Not rendered |
| Earthworks summary table (cut/fill/net volumes) | Subdivision regulations | ⚠️ `EarthworksCalculator.tsx` computes but doesn't render a formal summary table |
| Setting-out data table (bearing + distance + RL) | Survey Regs 1994 | ❌ No dedicated setting-out sheet format |
| Utility crossing annotation | Engineering survey convention | ❌ No utility layer rendering |
| Spot level elevation annotation (2dp) | RDM 1.1 | ⚠️ Shows elevation but not consistently to 2dp |
| Change-of-gradient levels on cross-sections | RDM 1.1 Section 5.6.2 | ❌ Only 20m interval levels captured, extra levels must be manually added |
| Drainage connection points with invert levels | RDM 1.1 | ⚠️ Manning's equation design exists but no pipe annotation with invert RL |
| Scale bar with metre divisions + RF | Survey Regs 1994 | ✅ Implemented in topo renderer |
| Datum/projection block (Arc 1960, UTM 37S) | RDM 1.1 | ⚠️ Partially shown in title block |
| Survey report separate from plan | Survey Regs 1994, RDM 1.1 | ❌ Plan and report are the same output; Table 5.3 Mobilisation Report missing |
| Signature block on engineering plans | Survey Regs 1994 | ⚠️ Partial — declaration block exists in topo renderer title block |

---

## 3. Comparison: Cadastral vs Engineering Plans

| Element | Cadastral (Form No. 4) | Engineering Survey Plan |
|---|---|---|
| Primary output | Deed plan / boundary plan | Topographic feature map + cross-sections |
| Key annotation | Bearings & distances on every boundary leg | Spot heights, contours, chainage stations |
| Beacon schedule | ✅ Mandatory | N/A (control points instead) |
| Area computation | ✅ Ground area (scale factor corrected) | N/A (volumes instead) |
| Abuttals | ✅ N/S/E/W mandatory | N/A |
| Cross-sections | N/A | ✅ At 20m intervals + extra at gradient changes |
| Setting-out data | N/A | ✅ Bearings, distances, RL per point |
| Surveyor declaration | ✅ Signed declaration block | ✅ Signed declaration block |
| Location diagram | Recommended | ✅ Mandatory for subdivisions |
| Earthworks summary | N/A | ✅ Cut/fill/net volumes in table |
| NLIMS submission | ✅ Form No. 4 + beacon certificate | ❓ Engineering plans submitted as attachments to cadastral |

---

## 4. Sources

The following Kenya-specific documents define the standards above:

1. **Survey Act Cap. 299** — Republic of Kenya, Laws of Kenya. Available through Kenya Law eKBRary (laws.loK/library).

2. **Survey Regulations 1994** — Legal Notice under Cap. 299. Specifies field procedures, document requirements, beacon types.

3. **RDM 1.1 (2025)** — Survey of Kenya Reference Data Manual. Sections 5.1–5.6 cover survey control accuracy (Table 5.1), detailed survey tolerances (Table 5.2), mobilization report (Table 5.3), topographic field survey report (Table 5.4), cross-section procedures (Section 5.6.2), survey control marks register (Section 5.6.3).

4. **SRVY2025-1** — 2025 Survey Regulations. Specifies the new submission numbering format `[RS###_YYYY_###_R##]`, digital submission requirements, NLIMS XML schema.

5. **NLIMS Land Registration Guide** — Available through ArdhiSasa portal. Defines required fields for land registration submissions including Form No. 4, beacon certificates, and computation workbooks.

6. **METARDU audit-13.md** (internal document) — Contains copies of real Kenya survey reports (BIVA format) showing actual print output format. Documents gaps between METARDU output and real industry deliverables.