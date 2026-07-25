# METARDU — Geomatics Engineering Gap Analysis

**Audience:** Geomatics engineers doing cadastral, topographic, and engineering surveys in Kenya/East Africa.

**Date:** 2026-07-05

## Executive Summary

METARDU covers ~70% of a geomatics engineer's daily workflow. The core computation engine (traverse adjustment, leveling, COGO, area, coordinate transforms, deed plan generation) is solid and well-tested. The main gaps are in **field instrument integration** (total stations, GNSS rovers), **real-time quality control**, and **3D/photogrammetry** workflows.

This document identifies what's already strong, what's missing, and what to prioritize.

---

## ✅ What METARDU already does well

### Cadastral Survey
- Bowditch + Transit traverse adjustment (tested against known-answer datasets)
- Deed plan generation (Form No. 4) with Survey Act Cap. 299 compliance
- Cassini-Soldner ↔ UTM coordinate transformation (Kenya-specific)
- Parcel number validation (Kenya PNO format)
- NLIMS-ready export (XML + GeoJSON)
- Mutation plan generation
- Beacon registry with SoK-standard types (PSC, TSC, SSC, MB, IRP, RMB)
- Statutory validation gate (blocks export if closure/tolerance fails)
- Cryptographic seal on projects (tamper detection)

### Topographic Survey
- TIN generation from point data (Delaunay triangulation)
- Contour generation (marching triangles algorithm)
- Slope analysis (IDW grid + Horn's method)
- Point cloud import (LAS/LAZ/PLY)
- Orthophoto viewer with tracing tools
- 3D TIN viewer (Three.js)
- Volume computation (end-area, prismoidal)
- Cut/fill analysis with heat map

### Engineering Survey
- Road design (horizontal + vertical curves, superelevation, sight distance)
- Cross-section generation
- Earthwork quantities (cut/fill, mass haul)
- Setting-out data (chainage, offset, bearing)
- Leveling (Rise & Fall, Height of Collimation)
- Level network adjustment
- Drainage design (pipe gradient, Manning's equation)
- Machine control export (IFC 4.3, LandXML)

### Quality Control
- Traverse closure check (linear + angular misclosure)
- Precision ratio evaluation (1:5000 to 1:20000 per Survey Act Cap. 299)
- Leveling closure tolerance (10√K mm per RDM 1.1)
- Topology guardrail (overlap/sliver detection)
- Statutory validation gate (pre-export checkpoint)
- Tamper-evident audit chain (SHA256 hash chain)
- Calculation cross-checks (NEW — Shoelace vs. triangulation, forward vs. reverse bearing, etc.)

### Platform
- 14-language i18n
- PWA (offline-first for field work)
- Capacitor mobile app (Android)
- 14 currencies, 60 UTM zones
- 9 survey types with dedicated workflows
- NLIMS + Ardhisasa integration stubs
- M-Pesa, Stripe, PayPal payments
- Drone photogrammetry pipeline (WebODM integration)

---

## 🔴 Critical Gaps (blocking production use)

### 1. Total Station Integration (CRITICAL)
**Problem:** No direct connection to total stations (Topcon, Leica, Sokkia, Trimble). Surveyors must record observations manually or use the manufacturer's software, then import CSV.

**Impact:** Every cadastral survey requires a total station. Without direct integration, METARDU is a "compute-only" tool — the field-to-finish flow is broken.

**Solution:**
- Web Serial API for USB/Bluetooth total stations (already have `InstrumentConnectionPanel` component)
- NMEA-0183 parsing for GNSS rovers (partially implemented in `nmea-parser.ts`)
- Topcon GSI format parser (exists in importers)
- Leica RAW format parser
- Sokkia SDR format parser
- Real-time streaming from instrument → field book (no manual data entry)

**Priority:** P0 — this is the #1 feature request from Kenyan surveyors

### 2. GNSS RTK Corrections (CRITICAL)
**Problem:** The NTRIP client exists but was broken (now fixed with SSRF protection). However, there's no RTK correction streaming to a GNSS rover. Surveyors can't use METARDU as a roving GNSS controller.

**Impact:** RTK GNSS is replacing total stations for many cadastral surveys. Without this, METARDU can't be the primary field tool.

**Solution:**
- BLE connection to GNSS rovers (Emlid Reach, Topcon HiPer, Leica GS18)
- RTCM3 correction forwarding via Bluetooth
- Real-time position display on the map
- Stakeout navigation (arrow + distance to target)
- Quality indicator (fix/float/solution age/satellites)

**Priority:** P0 — the StakeoutRadar component exists but needs the BLE plumbing

### 3. Real-Time Quality Control (HIGH)
**Problem:** Quality checks happen AFTER the survey is complete (post-processing). Errors are only caught when the traverse closes — if the first setup has a problem, the entire survey is wasted.

**Impact:** A surveyor can spend a full day in the field collecting data, only to discover at the end that the traverse doesn't close. Real-time QC would catch errors as they happen.

**Solution:**
- Real-time closure monitor (show running misclosure as each leg is added)
- redundant observation alerts (if a distance/bearing is entered twice with different values)
- Setup verification (check instrument height, target height, temperature/pressure before each setup)
- Statistical testing of observations (Chauvenet's criterion for outlier detection)
- Real-time precision indicator (running 1:N ratio as traverse progresses)

**Priority:** P1 — the engine supports it, but the UI doesn't surface it real-time

---

## 🟡 Important Gaps (should have for competitive parity)

### 4. Least Squares Adjustment (IMPORTANT)
**Problem:** Only Bowditch and Transit adjustments are implemented. Least Squares exists (`leastSquaresAdjustment.ts`) but has 0% test coverage and isn't wired into the UI.

**Impact:** Modern survey standards require LSQ adjustment for control surveys and overdetermined networks. Bowditch is sufficient for simple loops but not for networks with redundant observations.

**Solution:**
- Wire `leastSquaresAdjustment.ts` into the traverse computation UI
- Add tests for LSQ (known-answer tests from textbook problems)
- Add network adjustment UI (not just loop traverses)
- Show adjustment statistics (a posteriori reference variance, chi-square test)

**Priority:** P1 — the code exists, just needs wiring + testing

### 5. Coordinate System Management (IMPORTANT)
**Problem:** The app hardcodes EPSG:21037 (Arc 1960 / UTM 37S) in many places. Surveyors working in Uganda (UTM 36N) or on the Cassini-Soldner system have to work around this.

**Impact:** METARDU is Kenya-specific in its coordinate handling. East African expansion requires multi-zone support.

**Solution:**
- Dynamic CRS selection per project (already partially implemented in `ProjectionSwitcher`)
- Remove hardcoded `EPSG:21037` from computation modules
- Support custom CRS definitions (for local grid systems)
- Transform between datums (Arc 1960 ↔ WGS84 ↔ Arc 1960 UTM)
- 7-parameter Helmert transformation (exists in `computationalAccuracy.ts` but not wired to UI)

**Priority:** P1 — needed for East Africa expansion

### 6. Volume Computation from Point Clouds (IMPORTANT)
**Problem:** Volume computation uses cross-section method only. Point cloud volumes (TIN-to-TIN, grid method) are not implemented.

**Impact:** Mining and earthworks surveys need direct point cloud → volume computation without manual cross-section extraction.

**Solution:**
- TIN-to-TIN volume computation (difference between two surfaces)
- Grid method volume (rasterize both surfaces, subtract cell-by-cell)
- Stockpile volume from single surface + base plane
- Progressive volume tracking (compare epoch 1 vs. epoch 2)

**Priority:** P2 — the TIN engine exists, just needs the volume computation layer

### 7. Deformation Monitoring (MEDIUM)
**Problem:** The deformation tracker component exists but has 0% test coverage and minimal implementation.

**Impact:** Deformation monitoring is a niche but high-value market (dams, tunnels, landslides, buildings).

**Solution:**
- Epoch comparison (point cloud diff)
- Displacement vectors with statistical significance
- Time-series analysis (trend, velocity, acceleration)
- Alert thresholds (email/SMS when displacement exceeds tolerance)

**Priority:** P2 — the market is small but profitable

---

## 🟢 Nice-to-Have (future differentiation)

### 8. AI-Powered Survey QA
- Auto-detect outlier observations using ML
- Suggest corrections for common mistakes (transposed digits, wrong units)
- Pattern recognition for boundary disputes (compare deed plan vs. orthophoto)
- Auto-classify point cloud (ground vs. non-ground) using CSF — already implemented!

### 9. Collaborative Surveying
- Real-time multi-user editing (WebSocket collaboration server exists)
- Field crew coordination (who's at which setup, task assignment)
- Cloud sync (offline-first with conflict resolution)
- Surveyor marketplace (already prototyped in community page)

### 10. Regulatory Automation
- Auto-fill Ardhisasa submission forms (API integration when available)
- Auto-generate RIM (Registry Index Map) updates
- Auto-check boundary encroachment against neighboring parcels
- Auto-generate survey report per RDM 1.1 template

### 11. 3D Cadastre
- 3D parcel modeling (volumetric parcels for apartments, underground rights)
- 3D visualization of subsurface utilities
- Integration with BIM (IFC import/export already exists)

### 12. Satellite Imagery Integration
- Sentinel-2 / Landsat imagery for large-area topographic surveys
- Change detection (compare imagery epochs for boundary monitoring)
- SAR interferometry for millimeter-level deformation (landslide monitoring)

---

## 📊 Calculation Error Propagation Analysis

### How errors propagate in survey calculations

```
Bearing error (1° on 200m leg)
  → Coordinate error (3.5m)
    → Area error (700 m² on 1ha parcel = 7%)
      → Deed plan area mismatch
        → ArdhiSasa rejection
```

### Current error prevention measures

| Layer | Check | Status |
|-------|-------|--------|
| **Input** | Zod schema validation on all API inputs | ✅ Implemented |
| **Input** | Kenya coordinate bounds check (E 166000-1066000, N 9140000-10200000) | ✅ Implemented |
| **Computation** | Full IEEE 754 double precision (no intermediate rounding) | ✅ Implemented |
| **Computation** | Kahan summation for numerically stable addition | ✅ Implemented |
| **Computation** | Bowditch/Transit adjustment (distributes misclosure) | ✅ Implemented |
| **Computation** | Least Squares adjustment (statistical weighting) | ⚠️ Exists but untested |
| **Post-computation** | Angular misclosure check (15"√n per Cap. 299) | ✅ Implemented |
| **Post-computation** | Linear misclosure check (1:5000 to 1:20000 per class) | ✅ Implemented |
| **Post-computation** | Leveling closure (10√K mm per RDM 1.1) | ✅ Implemented |
| **Post-computation** | Area cross-check (Shoelace vs. triangulation) | ✅ NEW |
| **Post-computation** | Bearing cross-check (forward vs. coordinate-derived) | ✅ NEW |
| **Post-computation** | Distance cross-check (input vs. coordinate-derived) | ✅ NEW |
| **Post-computation** | Closure cross-check (traverse sums vs. coordinate round-trip) | ✅ NEW |
| **Post-computation** | Transform round-trip (forward + inverse = identity) | ✅ NEW |
| **Pre-export** | Statutory validation gate (blocks export if checks fail) | ✅ Implemented |
| **Pre-export** | Topology guardrail (overlap/sliver detection) | ✅ Implemented |
| **Audit** | Tamper-evident audit chain (SHA256 hash chain) | ✅ Implemented |
| **Audit** | Cryptographic seal on projects (migration 037) | ✅ Implemented |

### What's still missing for error prevention

1. **Real-time QC** — checks only run post-computation, not during data entry
2. **Redundant observation detection** — no check for "same leg measured twice with different values"
3. **Statistical outlier detection** — no Chauvenet's criterion or data snooping
4. **Error ellipse visualization** — computed but not displayed on the map
5. **Sensitivity analysis** — no "what if this bearing is off by X°" tool
6. **Monte Carlo simulation** — no uncertainty propagation via simulation

### Recommended additions

1. **Real-time closure monitor** — show running misclosure as each leg is added to the traverse
2. **Observation redundancy check** — flag when the same leg is observed twice with different values
3. **Error ellipse overlay** — display confidence ellipses on adjusted coordinates
4. **Sensitivity analysis tool** — "how much does the area change if this bearing shifts by 1°?"
5. **Pre-export cross-check suite** — run all cross-checks before allowing deed plan export
