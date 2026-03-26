# GEONOVA — FIELD WORKFLOW ARCHITECTURE
*The philosophy behind every feature we build*

## Why GeoNova Exists
Surveying is mentally exhausting work.
Long days in the field collecting observations,
followed by hours of manual computation,
misclosure checks, arithmetic verification,
report writing.

Mistakes under fatigue cause project delays,
financial loss, and professional stress.

GeoNova exists to remove that burden completely.

## The GeoNova Promise
A surveyor's only responsibility is:
- Choosing correct stations
- Setting up the instrument correctly
- Taking accurate observations

GeoNova handles everything else:
- All calculations
- All adjustments
- Error detection and warnings
- Field note organization
- Diagram generation
- Report generation

## The Core Pipeline
Every survey job follows this pipeline:

```
Choose Survey Type
      ↓
Collect Field Observations
      ↓
Enter / Upload to GeoNova
      ↓
Automatic Processing
      ↓
Validation + Error Detection
      ↓
Results + Coordinates
      ↓
Diagrams + Visualization
      ↓
Professional PDF Report
```

## Supported Survey Workflows

### 1. Closed Traverse Survey
Used for: control networks, boundaries, engineering
Engine: bowditchAdjustment(), transitAdjustment()
Output: Gale's Table, adjusted coordinates,
        precision ratio, grade, traverse diagram

### 2. Link Traverse Survey  
Used for: connecting two control points
Engine: bowditchAdjustment()
Output: same as closed + closing error vs known CP

### 3. Open Traverse Survey
Used for: roads, pipelines, corridors
Engine: distanceBearing(), coordinates
Output: running coordinates, cumulative distance

### 4. Leveling Run
Used for: benchmarks, road design, drainage
Engine: riseFallLeveling(), heightOfCollimation()
Output: RL table, arithmetic check, 
        closing error, longitudinal profile

### 5. Radiation / Detail Survey
Used for: topographic mapping, site plans
Engine: radiation() from cogo.ts
Output: coordinates, map plot

### 6. Setting Out / Stakeout
Used for: construction layout, pegging
Engine: distanceBearing(), settingOut()
Output: bearing + distance to peg,
        field movement instructions (N/S/E/W)

### 7. Boundary / Cadastral Survey
Used for: property boundaries, subdivision
Engine: traverse + coordinateArea()
Output: traverse + area + parcel plan + report

### 8. Road / Linear Survey
Used for: highways, railways, pipelines
Engine: open traverse + leveling + curves
Output: centerline coordinates, 
        chainage, cross sections, profile

### 9. Control Network Survey
Used for: high precision projects
Engine: Least Squares (Phase 7)
Output: adjusted network coordinates,
        precision analysis

## CSV Upload Vision
Surveyors upload one file — GeoNova does everything.

### Leveling CSV:
```csv
Station,BS,IS,FS
BM1,1.245,,
TP1,,,2.335
TP1,0.845,,
TP2,,,1.925
BM2,,,2.115
```
GeoNova: computes RLs, checks arithmetic,
         checks closure, generates report

### Traverse CSV:
```csv
Station,Bearing,Distance
A,045°30'00",100.000
B,120°15'00",085.000
C,200°00'00",095.000
```
GeoNova: computes coordinates, misclosure,
         Bowditch adjustment, Gale's Table,
         traverse diagram, report

### Radiation CSV:
```csv
Point,Bearing,Distance
P1,025°30'00",20.000
P2,075°10'00",30.000
P3,120°45'00",18.000
```
GeoNova: computes coordinates, plots map

## Universal Observation Model
Every field observation reduces to:
```
{
  station: string
  target?: string
  type: BS | IS | FS | ANGLE | DISTANCE | 
        BEARING | COORDINATE | ELEVATION
  value1: number
  value2?: number
}
```

## Error Detection Rules

### Traverse:
- Angular misclosure > ±1'√n → warning
- Precision < 1:1000 → POOR, block save
- Single leg correction > 3× average → blunder flag
- Bearing jump > 150° → check field reading

### Leveling:
- Arithmetic check failure → block results
- Closing error > ±12√K mm → warning
- Single IS reading anomaly → flag

### All surveys:
- Duplicate point names → block
- Impossible geometry → flag
- Missing required observations → prompt

## Architecture Rules
1. ALL math comes from src/lib/engine/ — never UI
2. Workflow modules call engine functions
3. Parser detects survey type from uploaded data
4. Validation runs before results are shown
5. Reports generate automatically after processing
6. Everything works offline after first load

## File Structure
```
src/lib/engine/          ← NEVER TOUCH (70 tests)
src/lib/workflows/       ← survey workflow logic
src/lib/parsers/         ← CSV + field note parsers
src/lib/validation/      ← error detection rules
src/lib/reports/         ← report generators
src/components/project/  ← project workspace UI
src/components/tools/    ← quick tool pages
```

## The Dream Scenario
Surveyor finishes fieldwork.
Uploads one CSV file to GeoNova.
GeoNova instantly delivers:
✓ Computed coordinates
✓ Reduced levels
✓ Misclosure check + grade
✓ Adjusted results
✓ Traverse / leveling diagram
✓ Professional PDF report

Time saved: hours of manual computation.
Stress eliminated: completely.

---
*Dedicated to every surveyor who deserves 
better tools for a demanding profession.*
