---
title: Curve Diagrams
tags: [curves, road-design, svg, visualization]
---

# Curve Diagrams

Professional SVG diagrams for horizontal and vertical curves — road design plan/profile sheets.

## Files
- `src/components/tools/SimpleCurveDiagram.tsx` — NEW plan-view circular curve diagram
- `src/components/tools/VerticalCurveProfile.tsx` — NEW profile (elevation) diagram
- `src/app/tools/curves/page.tsx` — curves calculator (simple/compound/reverse/vertical)
- `src/components/road-design/HorizontalCurveCalculator.tsx` — road design horizontal tab
- `src/components/road-design/VerticalCurveCalculator.tsx` — road design vertical tab

## SimpleCurveDiagram
Plan view showing:
- PI, PC (TC), PT (CT), centre O
- Tangent lines (T), arc (L), long chord (C), radius lines (R, dashed)
- External distance (E), mid-ordinate (M)
- Δ (deflection angle) marker
- North arrow + legend + key chainages table

Wired into:
- Curves tool (simple curve) — from `stakeout.elements` + chainages
- Road design horizontal tab — from `horizontalCurveElements` result

## VerticalCurveProfile
Profile (RL vs chainage) plot showing:
- Parabola (solid) + tangent grades G1/G2 (dashed)
- BVC, VPI, EVC points
- Peak (crest) / low point (sag) marker
- RL + chainage axes with ticks

Wired into:
- Curves tool (vertical curve) — from `tableRows`
- Road design vertical tab — from `verticalCurve` rows

## Related
- [[Contour Map Rendering]]
- [[Cut Fill Visualization]]
