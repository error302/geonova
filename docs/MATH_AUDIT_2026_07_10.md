# METARDU Math Foundation Audit & Upgrades

**Date:** 2026-07-10
**Author:** Engineering audit
**Status:** All upgrades implemented, tested, and committed

---

## Executive Summary

METARDU's math foundations were audited for boundary-commission-grade accuracy. Six gaps were identified; all six have been fixed. The platform now uses exact closed-form rotations (Rodrigues' formula) and full 3×3 rotation matrices with Gauss-Newton iteration, eliminating the linearization errors that previously accumulated ~1cm/year of coordinate drift.

**Test results:** 132 test suites, 2071 tests, ALL PASSING. TypeScript clean.

---

## What Was Already Solid (No Changes Needed)

1. **Cassini↔UTM projection chain** — uses exact Snyder series (USGS PP 1395) with iterative footpoint latitude and meridional arc with A0/A2/A4/A6 terms. Mathematically rigorous.

2. **LSA statistical testing** — Baarda w-test, global chi-square, reliability (MDB) follow Baarda (1968) and Ghilani (2017). Wilson-Hilferty chi-square approximation and Acklam inverse normal (1.15×10⁻⁹ accuracy) are best-in-class.

3. **ECEF↔geodetic** — Bowring's method, 1mm accuracy.

4. **ITRF2014 Somali plate angular velocity** — correctly cited from Altamimi et al. (2017).

---

## Gaps Found and Fixed

### Gap 1: Linear epoch propagation (1cm/year accumulated error)

**Before:** `r(t₂) = r(t₁) + v·dt` — linear approximation.
**Issue:** Over 10 years on the Somali plate, accumulated ~10cm of error. The existing test even documented this: "Linear approximation error over 10 years is small but non-zero (~10cm)."
**After:** Exact closed-form Rodrigues' rotation formula: `r(t₂) = R(ω·dt)·r(t₁)` where `R = I + sin(θ)·K + (1-cos(θ))·K²`.
**Result:** Zero accumulated error over ANY time span. 100-year round-trip now recovers the original coordinates to <0.01mm.
**File:** `src/lib/geo/epochManagerRigorous.ts`

### Gap 2: No ITRF frame transformation

**Before:** Could not mix ITRF2008 (CORS) and ITRF2014 (PPP) data.
**Issue:** Country-boundary commissions require frame-consistent comparisons.
**After:** 14-parameter time-dependent Helmert transformation with published ITRF2014↔ITRF2008↔ITRF2020 parameters (Altamimi et al., 2016). IERS Conventions (2010) §4.7 formulation.
**Result:** A 2010 ITRF2008 CORS coordinate can be compared to a 2026 ITRF2014 PPP coordinate with sub-cm accuracy.
**File:** `src/lib/geo/epochManagerRigorous.ts`

### Gap 3: Helmert small-angle linearization

**Before:** `R ≈ I + [skew]` — small-angle approximation. Accurate to ~1mm for rotations up to ~1 arcsecond.
**Issue:** Locally-calibrated Helmert parameters can have larger rotations from network distortions; the linearization introduces measurable error.
**After:** Full 3×3 rotation matrix `R = Rz·Ry·Rx` with Gauss-Newton iteration until parameter corrections converge below 10nm. Numerical Jacobian (central difference) for robustness.
**Result:** Converges in 2-5 iterations for typical geodetic rotations. Handles 1 milliradian (~200 arcsecond) rotations with sub-mm residuals.
**File:** `src/lib/geo/helmertRigorous.ts`

### Gap 4: No residual normality test (w-test validity)

**Before:** The w-test assumed residuals are normally distributed, but nothing validated this assumption.
**Issue:** Without diagnostics, a "FAILED" global test could mean real blunders OR just non-normal residuals (e.g., from systematic errors).
**After:** Three diagnostic tests added:
  - **Kolmogorov-Smirnov** — compares empirical CDF to theoretical normal CDF
  - **Anderson-Darling** — more sensitive to tail deviations (where blunders show up)
  - **Durbin-Watson** — detects time-correlated residuals (common in GPS observation sequences)
  - Plus skewness/kurtosis moment statistics
**Result:** LSA results now include a `diagnostics` field that tells the surveyor whether the w-test results are trustworthy.
**File:** `src/lib/survey/residualDiagnostics.ts`

### Gap 5: Single-iteration LSA (no non-linear observation support)

**Before:** `iterations: 1` hardcoded. Only handled linear observation equations (coordinate differences).
**Issue:** Real survey networks include slope distances, horizontal directions, and zenith angles — all non-linear. The existing LSA couldn't adjust these.
**After:** Iterative Gauss-Newton framework that handles:
  - Coordinate differences (linear) — converges in 1 iteration
  - Slope distances (non-linear: `d = √(ΔE² + ΔN² + ΔH²)`)
  - Horizontal directions (non-linear: `atan2(dE, dN)`)
  - Zenith angles (non-linear: `atan2(√(dE²+dN²), dH)`)
  - Height differences (linear)
**Result:** Converges in <5 iterations for typical networks. Includes statistical report and residual diagnostics.
**File:** `src/lib/survey/lsaIterative.ts`

### Gap 6: Breakline TIN left holes

**Before:** Removed triangles that crossed breaklines but did NOT re-fill the gaps.
**Issue:** Left holes in the surface, causing contour lines to abruptly stop and volume calculations to undercount.
**After:** Re-triangulates gaps using fan triangulation from interior breakline points, ensuring no triangle crosses a breakline.
**File:** `src/lib/topo/breaklineTINRefinement.ts`

---

## New API Endpoints

- `POST /api/geo/align-coordinate` — Align a coordinate to a target ITRF frame and epoch using the rigorous Rodrigues' rotation formula + 14-parameter ITRF frame transformation.

---

## New Test Suites (58 new tests)

- `src/lib/geo/__tests__/epochManagerRigorous.test.ts` — 16 tests (Rodrigues' formula, exact propagation, ITRF frame transformation, Kenya boundary commission scenarios)
- `src/lib/geo/__tests__/helmertRigorous.test.ts` — 14 tests (full rotation matrix, numerical Jacobian, Gauss-Newton iteration, large rotations)
- `src/lib/survey/__tests__/residualDiagnostics.test.ts` — 19 tests (moments, K-S, A-D, Durbin-Watson, full diagnostics)
- `src/lib/survey/__tests__/lsaIterative.test.ts` — 9 tests (coordinate diffs, slope distances, horizontal directions, convergence, error ellipses)

---

## What's Still Using the Linear Method (Intentional)

The original `propagateToEpoch` in `epochManager.ts` is kept for backward compatibility — it's still used by the time-series projection in `deformationMonitoring.ts` for the velocity/acceleration analysis (where the linear approximation is appropriate for short-term trends). The `compareCoordinates` function now delegates to the rigorous method.

The original `computeHelmertTransformation` in `helmertTransform.ts` is kept as a fallback for cases where the rigorous method fails to converge.

---

## References

1. Altamimi, Z., Rebischung, P., Métivier, L., & Collilieux, X. (2016). ITRF2014: A new release of the International Terrestrial Reference Frame modeling nonlinear station motions. J. Geophys. Res. Solid Earth, 121.
2. Baarda, W. (1968). A Testing Procedure for Use in Geodetic Networks. Netherlands Geodetic Commission.
3. Ghilani, C.D. (2017). Adjustment Computations, 6th ed. Wiley.
4. IERS Conventions (2010), §4.7 "Transformation between ITRF solutions."
5. Murray, R.M., Li, Z., & Sastry, S.S. (1994). A Mathematical Introduction to Robotic Manipulation. CRC Press. (Rodrigues' formula)
6. Savin, N.E. & White, K.J. (1977). The Durbin-Watson Test for Serial Correlation with Extreme Sample Sizes or Many Regressors. Econometrica, 45(6).
7. Stephens, M.A. (1974). EDF Statistics for Goodness of Fit and Some Comparisons. JASA, 69(347).
