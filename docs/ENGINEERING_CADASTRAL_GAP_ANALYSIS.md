# METARDU — Engineering & Cadastral Survey Gap Analysis

**Date:** 2026-07-05
**Focus:** Engineering survey and Cadastral survey workflows

---

## ENGINEERING SURVEY — Current State & Gaps

### What's already strong (80% coverage)

| Feature | Status | Notes |
|---------|--------|-------|
| Road design (horizontal curves) | ✅ | Simple, compound, reverse, spiral |
| Road design (vertical curves) | ✅ | Parabolic crest/sag, K-factor, SSD check |
| Superelevation | ✅ | RDM 1.3 compliant, transition length |
| Sight distance | ✅ | SSD + curve radius check + RDM 1.3 table |
| Cross-sections | ✅ | Generation + rendering + export |
| Earthworks (cut/fill) | ✅ | Grid method, TIN-to-TIN, stockpile |
| Mass haul diagram | ✅ | Generated from cross-sections |
| Leveling | ✅ | Rise & Fall, HoC, network adjustment |
| Setting out | ✅ | Chainage, offset, bearing/distance |
| Drainage design | ✅ | Pipe gradient, Manning's equation |
| Machine control export | ✅ | IFC 4.3, LandXML |
| Progress monitoring | ✅ | Cross-section comparison |
| As-built deviation | ✅ | Design vs. surveyed comparison |
| Volume progressive tracking | ✅ NEW | Multi-epoch comparison |
| Real-time QC | ✅ NEW | Running closure + setup checks |

### Engineering gaps to fix (20% gap)

**1. Road Design: Superelevation Runout Detail**
- **Gap:** The superelevation tool computes the rate and transition length, but doesn't generate the detailed runout diagram (tangent runout → spiral/runout → full superelevation).
- **Fix:** Add a "Superelevation Diagram" tab that shows the cross-slope transition profile (like a longitudinal section of the road crown).
- **Priority:** P2

**2. Horizontal Alignment: Intersection Point (IP) Coordinates**
- **Gap:** The curve calculator computes curve elements (T, L, E, M) but doesn't output the full alignment chainage table (IP chainage, TP chainage, curve mid-point chainage).
- **Fix:** Add "Generate Chainage Table" button that outputs the full alignment schedule.
- **Priority:** P1 — surveyors need this for setting out

**3. Vertical Alignment: Grade Analysis**
- **Gap:** No tool to analyze the grade profile (sustained grades, critical lengths, truck climbing lane warrants).
- **Fix:** Add grade analysis to the vertical curve designer — flag grades > 6% (Kenya standard for rural roads).
- **Priority:** P2

**4. Earthworks: Haul Distance Optimization**
- **Gap:** The mass haul diagram is generated but doesn't compute free-haul limit, overhaul, or borrow/spoil volumes.
- **Fix:** Add free-haul and overhaul analysis to the mass haul diagram (classic surveying computation).
- **Priority:** P1 — needed for earthworks cost estimation

**5. Construction Staking: Offset Tables**
- **Gap:** The setting-out tool computes chainage + offset, but doesn't generate batch offset tables for multiple chainages along a curve.
- **Fix:** Add "Generate Staking Table" — input: curve data + chainage interval → output: full table of stakes (chainage, offset L, offset R, elevation).
- **Priority:** P1 — the most common field task for engineering surveyors

**6. Bridge Survey: Pier Alignment**
- **Gap:** No tool for bridge pier setting out (perpendicular offsets from bridge centerline at pier locations).
- **Fix:** Add a bridge pier setting-out tool — input: centerline + pier chainages → output: pier coordinates + perpendicular offsets.
- **Priority:** P2

**7. Pipeline Survey: As-Built Pipeline**
- **Gap:** No tool for pipeline as-built surveys (invert levels, cover depth, joint positions).
- **Fix:** Add pipeline as-built tool — input: surveyed pipe points → output: cover depth check, invert profile, joint schedule.
- **Priority:** P2

---

## CADASTRAL SURVEY — Current State & Gaps

### What's already strong (85% coverage)

| Feature | Status | Notes |
|---------|--------|-------|
| Traverse adjustment (Bowditch) | ✅ | Tested against known-answer datasets |
| Deed plan generation (Form No. 4) | ✅ | SoK compliant, with seal of SoK block |
| Mutation plan generation | ✅ | Mutation forms with boundary changes |
| Cassini ↔ UTM transforms | ✅ | Kenya-specific Cassini-Soldner |
| Parcel number validation | ✅ | Kenya PNO format (KP/XX/YY) |
| Beacon registry | ✅ | SoK beacon types (PSC, TSC, SSC, MB, IRP, RMB) |
| NLIMS export | ✅ | XML + GeoJSON |
| Statutory validation gate | ✅ | Blocks bad exports (Cap. 299, RDM 1.1) |
| Cross-checks | ✅ NEW | 6 independent verification methods |
| Cryptographic seal | ✅ | Project-level tamper detection |
| Area computation | ✅ | Shoelace + cross-check via triangulation |
| Boundary diagram | ✅ | With adjacent LR numbers |
| Form C22 generation | ✅ | Cadastral form C22 |
| Scheme subdivision | ✅ | Block + parcel management |
| Subdivision generator | ✅ | Automated parcel subdivision |

### Cadastral gaps to fix (15% gap)

**1. Encumbrance/Easement Registration**
- **Gap:** No tool to register encumbrances (wayleaves, easements, rights of way) on parcels.
- **Fix:** Add encumbrance panel to the deed plan generator — surveyor can mark easement lines, wayleave corridors, and restriction areas on the parcel.
- **Priority:** P1 — required for utility wayleaves (KPLC, water pipelines)

**2. Composite Plan Generation**
- **Gap:** No tool for composite plans (multiple parcels on one sheet, registry index maps).
- **Fix:** Add composite plan layout tool — arranges multiple deed plans on A1/A0 sheets with registry index.
- **Priority:** P2

**3. Boundary Dispute Analysis**
- **Gap:** No tool to compare a deed plan boundary against a physical occupation (fence, wall) surveyed by GPS.
- **Fix:** Add boundary dispute tool — overlays deed plan boundary vs. surveyed occupation, computes encroachment area.
- **Priority:** P1 — boundary disputes are the #1 cadastral legal issue in Kenya

**4. Adverse Possession Analysis**
- **Gap:** The adverse possession calculator exists but isn't wired into the main workflow.
- **Fix:** Wire the `AdversePossessionCalc` component into the land-law section.
- **Priority:** P2

**5. Sectional Properties (Apartments)**
- **Gap:** No tool for sectional plan registration (apartment units, parking bays, common areas).
- **Fix:** Add sectional plan tool — defines units within a building, computes unit areas, generates sectional plan per Sectional Properties Act 2020.
- **Priority:** P1 — growing market in Nairobi apartment developments

**6. Community Land Registration**
- **Gap:** No tool for community land surveys (large communal boundaries per Community Land Act 2016).
- **Fix:** Add community land survey workflow — large-area boundary, participatory mapping, community land certificate.
- **Priority:** P2

**7. Title Dimension Tolerance Check**
- **Gap:** The statutory gate checks traverse precision but doesn't compare computed dimensions against the title dimensions (the distances/bearings on the existing title deed).
- **Fix:** Add title dimension comparison — input: title dimensions → compare with surveyed dimensions → flag discrepancies > tolerance.
- **Priority:** P1 — required for mutation surveys where the title must match

---

## Summary: Is METARDU enough?

### For Engineering Surveyors: ~80% coverage

**Sufficient for:** Road design surveys, site setting out, earthworks volumes, drainage design, as-built surveys, progress monitoring.

**Not yet sufficient for:** Detailed superelevation diagrams, mass haul optimization, batch staking tables, bridge pier alignment, pipeline as-builts.

### For Cadastral Surveyors: ~85% coverage

**Sufficient for:** Standard boundary surveys, mutations, subdivisions, deed plans, NLIMS export, scheme management.

**Not yet sufficient for:** Sectional properties, encumbrance registration, boundary dispute analysis, title dimension comparison, composite plans.

### Top 5 priorities across both disciplines

1. **Batch staking table** (engineering) — most common field task
2. **Title dimension comparison** (cadastral) — required for mutations
3. **Mass haul optimization** (engineering) — needed for cost estimation
4. **Boundary dispute analysis** (cadastral) — #1 legal issue
5. **Sectional properties** (cadastral) — growing Nairobi market
