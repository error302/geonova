# METARDU — MASTER PRODUCT BRIEF

## What METARDU Is

METARDU is a professional computation and documentation platform for surveyors, civil engineers, and related engineering professionals in East Africa. Its core purpose is to eliminate the burden of manual mathematical computation that currently consumes the majority of a field professional's office time after returning from a site survey.

A surveyor or engineer collects raw field data — coordinates, angles, distances, elevations, chainage readings — using a total station, GNSS receiver, level, or theodolite. They return to the office and currently face hours of manual computation: traverse adjustments, closure calculations, area computations, volume calculations, coordinate transformations, curve geometry, earthwork quantities, gradient checks, bearing derivations, and cross-section analysis. Every one of those computations is done manually in Excel, calculator, or AutoCAD. Every one is prone to human error. Every one takes time that should be spent on professional judgment, not arithmetic.

METARDU takes the raw field data in and produces every computation, every drawing, and every document automatically on the other side.

---

## The Full Scope of What METARDU Does

### Module 1 — Traverse Computation and Adjustment
- Import raw traverse field data: instrument station, backsight bearing, horizontal angles, slope distances, vertical angles
- Compute adjusted horizontal distances, reduced levels, and coordinates for each traverse station
- Apply Bowditch/Least Squares traverse adjustment
- Compute closing error, linear misclosure, precision ratio
- Classify accuracy to First Order Class I/II, Second Order Class I/II, Third Order per RDM 1.1 / Survey Act Cap 299
- Output: adjusted coordinate list, misclosure report, accuracy classification badge

### Module 2 — Coordinate Geometry (COGO)
- Inverse computation: given two coordinates, compute bearing and distance
- Polar computation: given a point, bearing and distance, compute new coordinates
- Intersection: compute intersection of two bearings from two known points
- Resection: compute unknown station coordinates from observations to known points
- Area computation: Shoelace formula from any polygon of coordinates
- Coordinate transformation: WGS84 ↔ ARC1960 ↔ Cassini-Soldner ↔ UTM Zone 36S/37S
- All computations shown step by step with full working so the surveyor can verify

### Module 3 — Levelling and Reduced Levels
- Import level book data: backsight, intermediate sight, foresight readings per station
- Compute reduced levels using Rise and Fall method and Height of Collimation method
- Automatic arithmetic check: sum of backsights minus sum of foresights equals first RL minus last RL
- Compute misclosure against allowable limit: `10√K mm` per RDM 1.1 Table 5.1
- Output: completed level book, RL schedule, misclosure report

### Module 4 — Survey Plan Generation
- From adjusted coordinates, generate a professional SVG survey plan
- Boundary lines with bearings and distances on each segment
- Monument symbols: PSC found/set, SSC, BM, Masonry Nail, Indicatory Beacon
- Lot fill, road reserve boundaries, survey corridor
- North arrow, scale bar, UTM grid, title block
- Right panel: plan information, bearing schedule, coordinate schedule, legend, surveyor's certificate per Survey Act Cap 299, ISK membership block
- Compliant with Survey Act Cap 299, Survey Regulations 1994, RDM 1.1 (2025)
- Export as vector SVG and print-ready PDF

### Module 5 — Road Design Geometry
- Horizontal curve design: given IP coordinates, deflection angle, radius — compute tangent length, curve length, mid-ordinate, external distance, chainage of TC/CC/CT points
- Vertical curve design: given grades G1 and G2, chainage of intersection, K-value — compute curve length, highest/lowest point chainage, RL at any chainage
- Superelevation and transition spiral design
- Sight distance check: stopping sight distance, passing sight distance — compare against RDM 1.3 standards for road class and terrain
- Gradient compliance check against RDM 1.3 absolute and desirable maxima
- Horizontal curve radius compliance against RDM 1.3 minimum radii table
- Output: curve data book, set-out table, compliance report

### Module 6 — Cross Sections and Earthworks
- Import cross section data: chainage, centreline RL, left and right ground shots at offsets
- Apply formation template: carriageway width, cut/fill slopes, shoulder width, camber
- Compute cut and fill areas at each cross section using coordinate method
- Compute volumes between sections: Prismoidal formula and End Area method
- Haul and overhaul computation
- Mass haul diagram generation
- Output: cross section drawings, earthwork quantities schedule, mass haul diagram

### Module 7 — Setting Out
- Compute setting out data from design coordinates to instrument station
- Output: bearing and distance from each instrument station to each setting out point
- Chainage and offset from centreline for each point
- Format as a setting out sheet the chainman reads directly in the field

### Module 8 — Document Generation
- Topographic Field Survey Report (RDM 1.1 Table 5.4) — 14 sections, auto-generated
- Mobilisation Report (RDM 1.1 Table 5.3) — 7 sections, auto-generated
- Control Point Register — per Section 5.6.3 RDM 1.1
- Bearing Schedule CSV export
- Earthwork Quantities Bill
- Curve Data Book
- Setting Out Sheet
- All documents branded with firm name, ISK number, drawing number
- All documents compliant with relevant Kenyan standards

### Module 9 — Field Data Import
- CSV import: label, easting, northing — for boundary corners and control points
- Raw total station download format: Leica GSI, Trimble JobXML, Topcon GTS
- Level book import: CSV with station, BS, IS, FS columns
- Cross section import: chainage, offset, RL columns

### Module 10 — Project Management
- Save and load projects
- Revision history with date, description, drawn by, checked by
- Multiple sheets per project
- Client management: store client name, contact, project history
- Drawing number auto-increment per firm
- Export complete project package: plan + all documents in one ZIP

---

## Who Uses METARDU

**Primary users:**
- Licensed land surveyors (ISK registered) — boundary surveys, topographic surveys, subdivision
- Civil engineers (EBK registered) — road design, earthworks, setting out
- Survey technicians working under licensed surveyors

**Secondary users:**
- Engineering firms managing multiple surveyors
- County government engineers
- Contractors doing setting out on KeNHA, KeRRA, KURA projects

**Geographic focus:**
- Kenya first — ISK, Survey Act Cap 299, RDM 1.1/1.3, ARC1960, KeNHA/KeRRA/KURA compliance
- East Africa expansion — Uganda, Tanzania, Rwanda share similar standards and instruments
- Diaspora Kenyan and African surveyors working internationally — earn in hard currency, understand the standard

---

## What Makes METARDU Different

Every computation METARDU performs is one that the surveyor currently does manually. The time saved is not marginal — it is the majority of the office portion of every project. A surveyor who spends 6 hours in the field currently spends another 4–8 hours in the office doing computations, writing reports, and formatting drawings. METARDU reduces that office time to under 30 minutes.

No existing tool does this for the East African market at an accessible price point. AutoCAD Civil 3D costs $2,500+ per year and requires specialist training. METARDU costs KES 4,999/month and requires only the ability to enter field data.

The computation engine is the product. The plan and the reports are the outputs. Everything in the platform exists to eliminate manual arithmetic from the professional engineering workflow.

---

## The One Line

**METARDU: From field data to finished documents — without the manual computation.**

---

## Implementation Status

| Module | Status | Details |
|--------|--------|---------|
| Module 1 — Traverse | ✅ Done | `traverseEngine.ts` — Bowditch/Transit adjustment, RDM 1.1 accuracy classification, closed traverse + raw field book (`TraverseFieldBook.tsx`, `/tools/traverse-field-book`) |
| Module 2 — COGO | ✅ Done | `distanceBearing()`, coordinate transforms, intersection, resection, area |
| Module 3 — Levelling | ✅ Done | `riseAndFall()` + `heightOfCollimation()` in `leveling.ts`, RDM 1.1 10√K misclosure, `LevelBook.tsx` raw field book + `/tools/level-book` |
| Module 4 — Survey Plan | ✅ Done | `SurveyPlanViewer.tsx`, SVG renderer, chainage markers, compliance checklist |
| Module 5 — Road Design | ✅ Done | Curve geometry, vertical curves, superelevation, sight distance, gradient check |
| Module 6 — Cross Sections | ✅ Done | Cross section import, area computation, volume calculation |
| Module 7 — Setting Out | ✅ Done | Bearing/distances from instrument station |
| Module 8 — Documents | ✅ Done | Auto-generated 14-section survey report (`surveyReport/`), subscription gate, photo upload |
| Module 9 — Field Import | ✅ Done | `totalStation.ts` — Leica GSI, Trimble JobXML, Topcon GTS, Generic CSV parsers |
| Module 10 — Project Mgmt | ✅ Done | Supabase-backed projects, sheets, clients, revision history |

**Key commits:**
- `68f30ef` — feat(field): traverse field book + level book modules
- `d6bbed5` — feat(survey): chainage system and survey corridor
- `5116414` — feat(report): auto-generated RDM 1.1 survey report
- `19d421a` — feat: compliance checklist, coordinate converter, datum fix, accuracy badge
- `cfe3f4b` — docs: save METARDU master product brief
- `bfcf084` — feat(setting-out): Brief 10 — setting out module with BS bearing, Hz/HD/VA/SD table, coordinate tolerance check (RDM 1.1 Table 5.2 ±25mm/±15mm), stake-out field sheet, chainage-offset table, CSV import. Fixes shoelace closing edge bug in earthworksEngine.
- `6666e6a` — feat(subscription): Brief 11 — featureGates (TIERS config, canAccess/getLimit), subscriptionEngine (access checks, usage tracking), SubscriptionBadge, PricingCard, billing page (cancel/reactivate), Stripe webhook handler, plan_usage migration, UpgradeModal rewrite

### Computation Integrity Rules (permanent)
- All formulas cite RDM 1.1/RDM 1.3 or academic source in comments
- No assumed values — all inputs from user or derived from user data
- Intermediate values shown in derivation steps
- Expected test values verified against independent calculation, not against brief (brief values may contain typos — engine correctness takes priority)
