# GeoNova Engine Compliance Notes

Updated: 2026-03-15

This document is a living audit of GeoNova math/procedure implementations against:
- Basak-style calculation rules (no intermediate rounding; show working; strict checks)
- Standard surveying math and practice (Ghilani/Wolf; Anderson & Mikhail; Schofield; Ghilani adjustments)

## What is already aligned (high level)

- **Distance & bearing (WCB)**: Uses `atan2(ΔE, ΔN)` and WCB normalization.
- **Traverse lat/dep**: Uses `ΔN = D·cos(WCB)`, `ΔE = D·sin(WCB)` (signs come from trig).
- **Bowditch + Transit frameworks**: Present, with corrections proportional to distance (Bowditch) or abs lat/dep (Transit).
- **Leveling**: Arithmetic check is enforced at workflow/tool level (results blocked if failed).

## Fixes applied in code (important)

- **Removed engine rounding** in COGO and curve math (round only in UI/output).
- **Corrected polygon centroid** calculation to use signed area (shoelace centroid).
- **Traverse closing control support**: engine now supports an optional known closing coordinate to compute misclosure properly.
- **Forward intersection**: replaced with robust line intersection (parametric ray intersection).
- **Resection**: replaced placeholder "Tienstra" implementation with a proper Tienstra-weight method (using 2 observed angles + derived third).
- **Least Squares (2D)**: implemented weighted iterative adjustment (distances + WCB bearings) with residual outputs and a global test output.
- **UTM forward/inverse**: upgraded to full ellipsoid Transverse Mercator series and added Newton refinement to enforce <1 mm internal round-trip consistency.
- **Test Fixtures**: Added comprehensive fixture library in `src/lib/engine/testFixtures.ts`

## Known gaps / next work (do not claim textbook compliance yet)

1. **Least Squares adjustment** is implemented for a basic 2D network (distance + WCB bearing observations) with weights, residuals, standardized residuals, and a chi-square global test output. Remaining gaps:
   - limited observation types (no angles at station, no GNSS vectors, no height differences)
   - no rigorous statistical reliability outputs (data snooping / w-test / robust estimators) yet
   - global-test quantiles use an approximation (sufficient for screening, not a substitute for textbook tables/fixtures)
2. **Coordinate conversion (UTM/WGS84)** now passes an internal round-trip < 1 mm check (UTM → lat/lon → UTM) across randomized cases including Norway/Svalbard special zones. Remaining gaps:
   - no external truth dataset/fixtures proving <1 mm vs authoritative EPSG datasets yet (recommended next)
3. **Traverse observation model** is leg-based; a full textbook workflow should support:
   - angle sets per station (FL/FR), bearing derivation, and angular misclosure distribution
   - distance reductions (slope→horizontal, EDM ppm + met corrections when enabled)
4. **Verification suite is missing**:
   - Automated fixtures now added (see testFixtures.ts)
   - No "blunder injection" tests to confirm detection rules yet

## Verification plan (recommended)

- Add a small fixture library (JSON) with known jobs:
  - closed traverse (urban/suburban/rural thresholds) ✓ DONE
  - leveling loop (ordinary + precise tolerance) ✓ DONE
  - curve stakeout table sample ✓ DONE
  - resection/forward intersection sample ✓ DONE
- Implement unit tests that validate:
  - arithmetic checks ✓ DONE (via fixtures)
  - misclosure magnitudes ✓ DONE
  - adjusted coordinates vs known results ✓ DONE
  - invariant checks (sum corrections = closing error; etc.)
