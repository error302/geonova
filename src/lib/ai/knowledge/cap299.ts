/**
 * Survey Act Cap 299 (Kenya) — Complete Reference Knowledge
 *
 * Enriched from: Survey Act Cap 299, Survey Regulations LN 168/1994,
 * Land Survey Submission Standards SRVY2025-1, Cadastral Survey
 * Standards Guidelines Manual 2nd ed 2024, wanyoike TS19-2 (RIM).
 *
 * Injected into the offline WebGPU LLM system prompt so the assistant
 * can answer grounded questions about Kenyan cadastral practice.
 */

export const CAP_299_KNOWLEDGE = `
SURVEY ACT CAP 299 (KENYA) — COMPLETE REFERENCE

── LEGAL FRAMEWORK ──────────────────────────────

The Survey Act Cap 299 governs all land surveys in Kenya. The Director of
Surveys (Nairobi) is the national authority. The Land Surveyors Board licenses
surveyors and hears disputes. A "licensed surveyor" is a surveyor duly licensed
under the Act. Only a licensed surveyor can authenticate a cadastral survey.

All survey plans and records become property of the Government (s.30). The
Director authenticates plans (s.32) and may cancel authentication (s.33). The
Director does NOT release final documents for title registration without the
licensed surveyor's EXPRESS authority (Reg 26(6)).

── SURVEY WORKFLOW (the complete pipeline) ──────

1. PRIMARY INVESTIGATION (PI) — Before any field work:
   - Obtain all available info on the plot AND adjoining plots (Reg 29).
   - Apply to Director for info in writing; state freehold/leasehold.
   - Obtain prior approval from statutory authorities for subdivision etc. (Reg 30).
   - Obtain letter of authority for entry upon land — Form D (Reg 31).

2. FIELD SURVEY — Methods per Reg 51-68:
   - Triangulation / Trilateration / Traverse / Air Survey / GPS/GNSS.
   - Field notes on special forms, black/blue indelible ink, NO erasures (Reg 69-77).
   - Instrument: theodolite make/model recorded; measuring band officially numbered
     and submitted for comparison yearly (Reg 25).

3. COMPUTATIONS (Reg 78-85):
   - On special forms; traverse closure, area by coordinates.
   - Independent checks mandatory (Reg 82).
   - Area accuracy: 1/200 for agricultural, 1/500 for urban (Reg 84).

4. PLAN PRODUCTION (Reg 86-98):
   - Plans on special forms, scales 1:500 (urban), 1:1000, 1:2500, 1:5000.
   - Show: coordinates, numerical data, abutting boundaries, topography.
   - Surveyor's certificate (Reg 97) + Director's authentication (Reg 98).

5. SUBMISSION TO DIRECTOR (per SRVY2025-1):
   Three mandatory deliverables:
   (i)  Survey Report (PDF) — Project Details, Methodology, Results, Conclusion.
   (ii) Final Spatial Data (ZIP of shapefiles: .shp/.shx/.dbf/.prj/.xml/.cpg).
   (iii) Raw + Digital Field Book (ZIP subfolders: GNSS Raw, Digital Field Book,
         Level Data) — BOTH generic (.csv/.txt/.fbk/.landxml/RINEX) AND native
         instrument formats (.raw/.job/.sdr/.rw5/.t01/.gsi etc.).
   Survey Submission Number: [RegNo]_[YYYY]_[###]_[R##] e.g. RS149_2025_002_R01.

── COORDINATE SYSTEMS (Reg 24) ───────────────────

- UTM zones 36 or 37 using Clarke 1880 (modified):
  semi-diameter-major 6,378,249 m, ellipticity 1/293.465.
- OR Cassini-Soldner (Clarke 1858):
  semi-diameter-major 6,378,351 m, ellipticity 1/294.26.
  Calculated from odd-degree meridians, 2-degree zones.
- CRS used in Kenya today: Arc 1960 / UTM zone 37S (most common),
  WGS84 for GNSS work with transformation parameters.

── TRAVERSE STANDARDS (Reg 57-67) ──────────────

Class A (Urban/Township): linear misclosure <= 1:10,000
Class B (Rural Cadastral): linear misclosure <= 1:4,000
Class C (Agricultural/Ranching): linear misclosure <= 1:2,000

Angular misclosures:
Class A & B: max = 30" * sqrt(N)
Class C: max = 60" * sqrt(N)
where N = number of traverse stations.

- Traverse must be tied to at least two known Government control points (Reg 66).
- Swinging/hanging traverses are permitted (Reg 65).
- Curvilinear boundaries surveyed by offset from chord (Reg 63).

── BOUNDARY BEACONS (Reg 37-50, Part VI) ───────

- Standard beacon: angle iron set in concrete, min 15 cm above ground.
- Line beacons and river beacons: special rules (Reg 40).
- Beacons placed on boundary line from computed data (Reg 41-42).
- Damaged beacons CANNOT be repaired — must be re-established (Reg 45).
- Missing beacon re-establishment procedure (Reg 47-48).
- Redundant beacons must be removed (Reg 49).
- Offset beacon (witness mark) when corner falls in river (Reg 40).

── REGISTRY INDEX MAP (RIM) — wanyoike TS19-2 ────

The RIM is the most common map for rural land registration under the
Registered Land Act (Cap 300). It uses the "general boundary" system:
the precise line is undetermined within the breadth of physical features.

RIM sheet shows: Location, Sheet Number + Index, Plot Number, Scale,
Edition number, Sheet History (all amendments since first publication),
North Point.

RIM is used for: first registration (consolidation/adjudication/settlement),
subdivision of registered land, rural planning, boundary disputes.

MUTATION FORM (s.19(1) RLA): required to amend the RIM. No boundary
correction can be made except on Registrar's instructions via mutation form.

── FIELD NOTES (Reg 69-77) ──────────────────────

- On special Survey of Kenya field book forms.
- Black or blue indelible ink. NO erasures — single-line cross-out, initialed.
- Every page: instrument details, weather, date, survey party names.
- Cover + page index required.
- Triangulation: record in standard form (Reg 70).
- Traverse: station, angle, distance, bearing format (Reg 71).
- Topographical features recorded (Reg 72).
- Unorthodox methods documented (Reg 77).

── PLANS (Reg 86-98, SRVY2025-1 s.4) ──────────

Survey Plan must include:
  Marginalia: project title, client, surveyor name/reg no, date, scale,
    north arrow, CRS.
  Survey Control: all H&V control points, coordinates, datum, benchmarks.
  Site Features: boundaries with dims + bearings, natural features,
    man-made structures, easements, rights-of-way.
  Observations: stations, instrument positions, traverse/GNSS network.
  Map Figures: Site Location, Boundary, Topographic, Control, Utility.
  Legend + Notes + signed Certification by Registered Surveyor.

── DEED PLANS (Reg 99-109) ─────────────────────

- On special A4 forms (Reg 99).
- Show: numerical data, topographical features, abutting boundaries.
- Locality index number, surveyor name, area.
- Authentication by Director (Reg 108).
- Cancellation of deed plan procedure (Reg 109).

── MEASURING EQUIPMENT (Reg 25) ────────────────

- Bands, tapes, thermometer, spring balance submitted to Director before
  use and yearly thereafter for comparison with official standard.
- Each band gets a unique official number.
- Breakage recorded in field notes.
- Director may refuse to authenticate survey made with defective equipment.

── FEES (Reg 34-35) ────────────────────────────

- Director charges per Fifth, Sixth, Seventh Schedules.
- Licensed surveyors charge per Eighth Schedule (scale of fees).
- Charging below prescribed fee: offence, fine up to KES 5,000 or
  imprisonment up to 5 months (Reg 35(2)).

── REPORTING UNITS (SRVY2025-1 s.2.4) ──────────

Coordinate values: metres (projected CRS)
Distances: metres
Bearings: decimal degrees referenced to true north
Areas: square metres (m²)
Elevation: Mean Sea Level (MSL)

── SURVEYOR RESPONSIBILITY ──────────────────────

- Licensed surveyor is PERSONALLY responsible for accuracy, fidelity,
  and completeness of every survey (Reg 26(1)).
- Must perform sufficient work to apply thorough check to every part (Reg 26(3)).
- Approved assistants: work under personal control of licensed surveyor,
  who accepts full responsibility (Reg 33(4)).
- Assistant certifies + signs field notes; licensed surveyor countersigns (Reg 33(5)).
- Employer certificate in Ninth Schedule form.

── LIMITATIONS OF THIS ASSISTANT ─────────────────

- An AI cannot approve or certify a survey plan.
- Only a Licensed Surveyor registered under the Survey Act can authenticate.
- The Director of Surveys is the final authority on all survey matters.
`