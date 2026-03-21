'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PageProps {
  params: { type: string }
}

interface Step {
  id: number;
  title: string;
  juniorContent: string;
  seniorContent: string;
}

interface Guide {
  title: string
  icon: string
  steps: Step[]
  fieldChecklist?: string[]
  stopRules?: string[]
}

const guideData: { [key: string]: Guide } = {
  'closed-traverse': {
    title: 'Closed Traverse',
    icon: '🔗',
    fieldChecklist: [
      'Project datum / UTM zone / hemisphere confirmed (no guessing)',
      '2+ control points verified and recovered on ground (IDs match)',
      'Instrument centered + leveled; centering re-checked after leveling',
      'HI/HR and prism constant recorded; EDM units/settings confirmed',
      'Angles observed FL/FR (or repeated sets) and booked immediately',
      'Distances repeated or within EDM spec; slope vs horizontal noted',
      'Angular check performed (misclosure within ±1\'√n) before leaving site',
      'Field sketch + station descriptions + witness ties completed',
    ],
    stopRules: [
      'Cannot prove control reliability OR coordinate system/UTM zone is uncertain',
      'Angular misclosure exceeds ±1\'√n after re-observation',
      'Linear precision worse than 1:1000 after re-checks (Basak: reject)',
      'A single leg correction > 3× average and no field cause found (blunder likely)',
      'Backsight/orientation is unstable (backsight point moved/unclear)',
      'Intervisibility breaks and stations are improvised without re-planning',
    ],
    steps: [
      {
        id: 1,
        title: 'Reconnaissance',
        juniorContent: `STEP 1 — RECONNAISSANCE (FIELD SOP)
Goal: design a traverse that can be observed cleanly, checked on-site, and will close.

Minimum equipment (trainee-safe):
• Total station + tribrach + tripod (spikes working)
• Prism + pole + bipod (stable)
• Plumb bob / optical plummet, rod bubble
• Pegs/nails/paint + hammer + marker
• Field book (or METARDU Field Mode) + backup pen
• Tape (for short ties), machete/brush cutter if needed
• PPE: boots, vest, helmet if construction site

Recon rules (do NOT skip):
1) Walk the whole polygon route.
2) Confirm intervisibility: every station must see the next AND previous station.
3) Choose stable stations: firm ground, not loose soil, not on traffic/vibration, not on manhole covers.
4) Avoid bad geometry: very short legs mixed with very long legs; keep legs “reasonable” and balanced.
5) Plan closure: close back to start OR to a different known control point (preferred for a stronger check).
6) Identify recovery: record a witness tie for each station (e.g., “0.80 m to tree”, “1.20 m to wall corner”).

Booking template (copy into field book):
Station | BS To | FS To | FL Angle | FR Angle | Slope Dist | Vert Angle | HI | HR | Notes
Check: Σ(angles) vs theoretical, and note any repeats/rejections.

Trainee “stop gate” during recon:
If you cannot guarantee intervisibility and a realistic closure plan, STOP and redesign stations before observing.`,
        seniorContent: `1. Reconnaissance — confirm intervisibility between all stations`
      },
      {
        id: 2,
        title: 'Establish Control',
        juniorContent: `STEP 2 — ESTABLISH CONTROL (FIELD SOP)
Control is the foundation. If control is wrong, every coordinate you produce is wrong.

Minimum control requirement (trainee-safe):
• At least TWO known points (different coordinates)
• Their IDs must match what is on the ground (beacon ID / BM name / peg label)
• Your project coordinate system must be explicit: UTM zone + hemisphere + datum (WGS84/Local)

Control verification procedure:
1) Recover control physically (find the mark, not just “near it”).
2) Photograph the mark and its surroundings.
3) Take a short witness tie (offsets to nearby permanent features).
4) Check the control pair:
   • Measure distance and bearing between the two control points (one quick setup is enough).
   • If the measured check is inconsistent with expected values (or differs unreasonably), STOP.

If control comes from GNSS today:
• Confirm fix quality (RTK FIX vs FLOAT), PDOP, and occupation time.
• Re-observe at least once (repeat occupation) if the job is cadastral/engineering.

METARDU setup:
→ Project Settings: confirm UTM zone + hemisphere
→ Add both control points as Primary Control
→ Lock them (prevents accidental edits)

Trainee stop gate:
If you cannot state the control source, datum, and verification check you performed, STOP.`,
        seniorContent: `2. Establish 2+ known control points in METARDU as Primary Control`
      },
      {
        id: 3,
        title: 'Set Up Instrument',
        juniorContent: `STEP 3 — SET UP INSTRUMENT (FIELD SOP)
Objective: occupy the correct station, centered and leveled, with known HI/HR and correct EDM settings.

Setup sequence (do in this order):
1) Tripod: legs firm, head roughly level, station mark centered under head.
2) Mount instrument + tribrach; lock lightly.
3) Centering: optical plummet/plumb bob to station mark (fine adjust).
4) Leveling: circular bubble → plate bubble → electronic level (fine).
5) Re-check centering AFTER leveling (leveling often shifts centering).
6) Record HI (instrument height) to 0.001 m if possible.
7) Prism: confirm HR (prism height), prism constant, and target type.
8) Instrument settings: units = meters; angles = DMS; EDM mode correct (prism/reflectorless); apply met corrections if used.

Quick “orientation sanity” before observing:
• Sight the backsight point. Confirm the point ID and that it is stable.
• Set/record your reference: either set Hz = 0°00'00" on backsight OR record the backsight bearing explicitly.

Trainee stop gate:
If you cannot keep the bubble centered through a full rotation, or centering keeps drifting, STOP (tripod not stable / legs sinking).`,
        seniorContent: `3. Set up instrument, record HI, centre over first station`
      },
      {
        id: 4,
        title: 'Measure Observations',
        juniorContent: `STEP 4 — MEASURE OBSERVATIONS (FIELD SOP)
At every station, your job is to produce reliable angles + distances with redundancy.

Station observing pattern (recommended):
1) Set up on station i (HI recorded).
2) Backsight to station i−1 (confirm ID). Set Hz reference (0°00'00") OR record the backsight bearing.
3) Foresight to station i+1 (confirm ID). Observe:
   • Horizontal angle
   • Distance (prefer horizontal distance; if slope distance is recorded, record vertical angle too)
4) Repeat as a set:
   • Face Left (FL) + Face Right (FR), or two full sets if instrument is simple.

Distance handling (trainee-safe):
• If your total station shows BOTH slope and horizontal distance, book the horizontal distance for traverse.
• If you only have slope distance, you MUST record vertical angle and reduce to horizontal (do not ignore).

Field tolerances (set your job tolerance before starting):
• FL vs FR angle difference: re-observe if outside your tolerance (example: 20″).
• Distance repeats: re-measure if outside instrument spec (example: > (2 mm + 2 ppm × D)).
• If backsight is disturbed (person kicks peg / prism moved), redo the station immediately.

Angular check (do this BEFORE leaving site):
• If you observed included angles for an n-sided closed traverse:
  Theoretical sum = (n − 2) × 180°
  Allowable misclosure (Basak) = ±1' √n
• If the misclosure exceeds the limit: find the problem station and re-observe (do not wait for office).

METARDU entry tip:
If you enter bearings/distances (instead of raw angles), ensure your bearings are Whole Circle Bearings (0–360°) and consistent with your backsight reference.`,
        seniorContent: `4. FL + FR observations each leg. Enter in METARDU Traverse tool`
      },
      {
        id: 5,
        title: 'Compute Traverse',
        juniorContent: `STEP 5 — COMPUTE + QUALITY CHECK (FIELD/Office SOP)
METARDU computes the traverse and tells you whether it is acceptable.

METARDU computes:
✓ Latitude/Departure per leg (Lat = D×cos(WCB), Dep = D×sin(WCB))
✓ Closing error (ΔE, ΔN) and linear misclosure
✓ Relative precision ratio (Total traverse length / Misclosure)
✓ Bowditch corrections per Basak:
  corrE = -(legD/totalD) × closingErrorE
  corrN = -(legD/totalD) × closingErrorN
✓ Adjusted coordinates + Gale’s Table output

Acceptance gates (Basak):
• Urban cadastral:  ≥ 1:5000
• Suburban:         ≥ 1:3000
• Rural:            ≥ 1:1000

If precision is POOR (trainee workflow):
1) Check for “obvious” blunders:
   • Wrong station ID / swapped from-to
   • Wrong face reading typed
   • Wrong HI/HR or prism constant
   • Decimal point error on distance
2) Look at corrections per leg:
   • If one leg correction is > 3× average, suspect that leg first.
3) Re-observe the suspect station/leg immediately (best), then re-run.

Hard stop rules:
• Precision < 1:1000 after re-observation → reject and redesign/re-observe.
• Angular check exceeds ±1'√n and cannot be isolated → re-observe angles.
• Closing to a known point fails significantly (link traverse) → control or orientation problem.`,
        seniorContent: `5. Run traverse in METARDU. Check precision ≥ 1:3000`
      },
      {
        id: 6,
        title: 'Generate Report',
        juniorContent: `STEP 6 — DELIVERABLES + HANDOVER (SOP)
Before you “finish the job”, make the work defendable.

In METARDU:
→ Generate Report (PDF)

Minimum deliverables for a closed traverse job:
• Control point list (names, coordinates, datum/UTM zone)
• Raw observations summary (angles/distances, sets count)
• Misclosure values (ΔE, ΔN, linear) + precision ratio + grade
• Adjustment method stated (Bowditch) + per-leg corrections
• Final adjusted coordinates table
• Diagram/sketch reference (station descriptions + witness ties)

Trainee rule:
Never discard raw field notes. If a coordinate is challenged later, raw notes are your evidence.`,
        seniorContent: `6. Generate Report in METARDU and submit`
      }
    ]
  },
  'leveling': {
    title: 'Leveling Run',
    icon: '📊',
    fieldChecklist: [
      'Instrument collimation known (Two Peg Test done if needed)',
      'Start BM RL confirmed; end BM/closure plan confirmed',
      'Balanced sight lengths (BS≈FS; within ~10 m)',
      'Turning points are hard/stable and clearly marked/witnessed',
      'Staff kept vertical (rod bubble) and readings to 0.001 m',
      'Call-and-repeat booking discipline followed (no memory booking)',
      'Arithmetic check done on-site before leaving (ΣBS−ΣFS = Last RL − First RL)',
    ],
    stopRules: [
      'Arithmetic check fails (ΣBS−ΣFS ≠ ΔRL)',
      'Closing error exceeds allowable (ordinary: ±12√K mm) after re-checks',
      'Turning point moved/unstable or staff point uncertain',
      'Sight lengths badly unbalanced and cannot be corrected by repositioning',
    ],
    steps: [
      {
        id: 1,
        title: 'Plan the Run',
        juniorContent: `STEP 1 — PLAN THE LEVELING RUN (FIELD SOP)
Goal: transfer RLs with a closed check and a passing arithmetic check.

Minimum equipment:
• Automatic/digital level + tripod (or total station in leveling mode)
• 2 staffs if possible (faster and safer), with rod bubbles
• Turning point plate (or solid peg) + chalk/marker
• Field book (or METARDU Field Mode) + backup pen

Before you start (trainee rule):
If instrument collimation is unknown OR the job is important → do a Two Peg Test first.
If Two Peg Test fails, STOP and rectify instrument (otherwise your RLs will be biased).

Plan your route:
1) Identify the starting benchmark (BM) with known RL.
2) Identify the closing BM (same BM loop closure is best) OR a second known BM.
3) Choose turning points (TPs):
   • every ~50–80 m (or as terrain demands)
   • hard/stable surface (concrete/rock/TP plate)
4) Compute the distance K (km) for tolerance checks.

Allowable misclosure (Basak):
• Ordinary leveling: ±12 √K mm
• Precise leveling:  ±6 √K mm

Booking template (copy into field book):
Station | BS | IS | FS | HI | RL | Remarks
Arithmetic check at end: ΣBS − ΣFS = Last RL − First RL

Trainee stop gate:
If you cannot close to a known RL (no end BM and no loop), STOP and redesign the run.`,
        seniorContent: `1. Plan route: start RL → turning points → end RL`
      },
      {
        id: 2,
        title: 'Set Up Level',
        juniorContent: `STEP 2 — SET UP THE LEVEL (FIELD SOP)
Setup objective: balanced sights + stable instrument = reliable RL transfer.

Setup rules (Basak/standard practice):
• Set instrument roughly midway between BS and FS points (BS ≈ FS distance).
• Keep BS−FS distance difference within ~10 m (tighter for high precision).
• Avoid very long sights; keep individual sights reasonable for conditions (often ≤ 60–80 m; avoid >100 m if possible).
• Avoid long sights over hot surfaces (tar roads) to reduce shimmer/refraction.
• Tripod legs firm; instrument level stable through rotation.

Trainee workflow at each setup:
1) Choose a stable spot with clear sight to BS and FS.
2) Level the instrument properly.
3) Focus eyepiece (remove parallax) before reading staff.
4) Take BS first, then FS (consistent pattern reduces mistakes).

Trainee stop gate:
If you cannot balance sights due to terrain, you MUST note it and shorten sights; otherwise stop and reposition.`,
        seniorContent: `2. Set up level midway between points, equal distances`
      },
      {
        id: 3,
        title: 'Take Readings',
        juniorContent: `STEP 3 — TAKE READINGS (FIELD SOP)
At each instrument setup, you will record BS/IS/FS in a strict pattern.

Recommended reading pattern:
1) BS to known point or TP (call-and-repeat; book immediately).
2) Any IS readings (if you need intermediate points).
3) FS to next TP (call-and-repeat; book immediately).
4) Move instrument; the FS point becomes the next setup’s BS point.

Staff handling rules:
• Staff MUST be vertical (use rod bubble; rock the staff to find minimum reading if needed).
• Book to 0.001 m (3 decimals) consistently.
• Do not “correct” readings later — re-read in the moment if unsure.

Turning point (TP) rules:
• Use a TP plate or solid point (concrete/rock/firm peg).
• Mark and witness the TP location; do not change it between BS and FS.
• Never use loose stones, soft soil, or vibrating surfaces (vehicles/construction).

Quick sanity check at each setup:
• Rise/Fall = BS − FS (for that setup). If it looks unreasonable, re-check immediately.

Trainee stop gate:
If a reading was not written immediately (memory booking), STOP and re-read; do not guess.`,
        seniorContent: `3. Take BS and FS readings. Record to 3 decimal places`
      },
      {
        id: 4,
        title: 'Compute in METARDU',
        juniorContent: `STEP 4 — COMPUTE + CHECK (METARDU SOP)
Enter the leveling data and DO NOT accept results until checks pass.

METARDU enforces Basak arithmetic check:
ΣBS − ΣFS MUST equal (Last RL − First RL).
If this fails: treat it as an error, not “close enough”.

If arithmetic check FAILS (blunder isolation):
1) Check for transcription errors (digit swap, wrong station line, wrong column).
2) Check that each TP appears twice correctly (FS then next BS).
3) Re-check staff units and decimal places.
4) If still failing, re-run the affected section in the field.

If arithmetic check PASSES:
• Check closing error against allowable tolerance (±12 √K mm ordinary).
• If out of tolerance: shorten sights, rebalance BS/FS, avoid heat shimmer, and re-run the section.

Trainee stop gate:
If arithmetic check fails OR misclosure exceeds allowable after re-checks, do not issue RLs.`,
        seniorContent: `4. Enter in METARDU Leveling tool. Check arithmetic passes`
      },
      {
        id: 5,
        title: 'Generate Report',
        juniorContent: `STEP 5 — REPORT + HANDOVER (SOP)
Deliverables should show the checks clearly (so your work is defensible).

In METARDU:
→ Generate Report (PDF)

Minimum report contents:
• Start BM RL and closing BM RL (known + observed)
• RL table (HI and/or Rise & Fall)
• Arithmetic check statement and values (ΣBS, ΣFS, ΔRL)
• Closing error and allowable tolerance (±12 √K mm ordinary)
• If adjustment applied: method stated + corrected RLs
• Notes: date/time, crew, instrument ID, any unbalanced sights and why

Trainee rule:
Keep the raw booking. If RLs are challenged later, your raw notes are the evidence.`,
        seniorContent: `5. Generate Report. Precision should be ≤ ±12√K mm`
      }
    ]
  },
  'radiation': {
    title: 'Radiation Survey',
    icon: '📡',
    steps: [
      {
        id: 1,
        title: 'Select Station',
        juniorContent: `STEP 1 — SELECT INSTRUMENT STATION
Choose a location that sees all points.

Criteria:
• Central position to all features
• Stable ground
• Clear sight lines
• Known coordinates (set up on control) or
  unknown (will need resection)

Training rule:
If you are not on known control, do NOT start measuring “detail points” yet.
First determine your station coordinates by resection (3+ known points) or by GNSS.

Quality tip:
Avoid very short rays (tiny distances) and very long rays in one setup. Keep geometry reasonable.`,
        seniorContent: `1. Select central instrument station with clear sight to all points`
      },
      {
        id: 2,
        title: 'Set Up & Occupy',
        juniorContent: `STEP 2 — SET UP INSTRUMENT
Centre and level the total station.

1. Set up tripod
2. Mount total station
3. Optical plummet to station
4. Fine level
5. Record HI (instrument height)`,
        seniorContent: `2. Set up instrument, record HI`
      },
      {
        id: 3,
        title: 'Take Readings',
        juniorContent: `STEP 3 — COLLECT RADIATION POINTS
Record bearing and distance to each feature.

For each point:
1. Aim at prism
2. Record horizontal angle
3. Record slope distance
4. Record vertical angle (for elevation)
5. Record prism height

Tip:
Use descriptive point names (e.g., "tree1",
"corner_fence", "road_edge")

Training checklist (detail survey discipline):
□ Agree point naming with your office standard
□ Record feature codes if required (fence, edge, building corner)
□ Re-observe 1 in every 10 points as a check
□ If elevations matter: record HI and HR consistently (don’t mix)

Stop rule:
If you lose orientation (backsight moved / wrong point), stop and re-orient before continuing.`,
        seniorContent: `3. Record bearing and distance to each point`
      },
      {
        id: 4,
        title: 'Process Data',
        juniorContent: `STEP 4 — PROCESS IN GEONOVA
Enter observations in Radiation mode.

In METARDU:
→ COGO Tools → Radiation
→ Enter station coordinates
→ Enter bearing and distance for each point
→ Coordinates are computed automatically

For multiple stations:
→ Use Radiation from each station
→ Points will have multiple observations`,
        seniorContent: `4. Enter in METARDU COGO → Radiation. Get coordinates`
      }
    ]
  },
  'setting-out': {
    title: 'Setting Out',
    icon: '📍',
    fieldChecklist: [
      'Design coordinates validated (units/datum/UTM zone)',
      'Occupied correct control point (ID confirmed)',
      'Orientation verified (backsight/resection check)',
      'Critical points double-checked (independent check)',
      'All pegs/marks labeled, witnessed, and protected',
      'As-staked check measurements recorded (for QA/as-built)',
    ],
    stopRules: [
      'Cannot reliably orient (backsight inconsistent)',
      'Control disturbed or uncertain',
      'CAD/design data projection mismatch suspected',
      'Independent check fails and cause cannot be identified',
    ],
    steps: [
      {
        id: 1,
        title: 'Prepare Data',
        juniorContent: `STEP 1 — PREPARE DESIGN DATA (SOP)
Setting out is only as good as the design data and coordinate system alignment.

Inputs you must have:
• Design coordinates (E,N) for all points to be staked
• Coordinate system definition (datum + UTM zone/hemisphere or local grid)
• Required tolerances (depends on project type)

Typical tolerances (guide only — follow project spec):
• Earthworks/rough grading: ±50 mm to ±100 mm
• General construction: ±20 mm
• High-precision (steel, machinery): ±5 mm to ±10 mm

Data validation (trainee-safe):
1) Confirm datum/projection/UTM zone matches the site control.
2) Confirm units (meters) and coordinate order (Easting, Northing).
3) Confirm CAD scale and that coordinates are “grid” (not paper units).
4) Do a reality check: pick 1–2 known points from the drawing and compare to field control.

In METARDU:
→ Add design points to the project OR import (DXF/CSV)
→ Tag critical points (building corners, PI points, services) for double-check.`,
        seniorContent: `1. Prepare design coordinates in METARDU project`
      },
      {
        id: 2,
        title: 'Establish Control',
        juniorContent: `STEP 2 — ESTABLISH CONTROL + ORIENTATION (FIELD SOP)
Objective: you must know exactly where you are and which direction is “grid north” for your design.

Best practice hierarchy:
1) Occupy known control point A and backsight known control point B (strongest orientation).
2) Resection with 3+ known points (redundancy) + check residuals.
3) Temporary control only after you establish it with a short closed traverse (and it passes precision gates).

Orientation verification (trainee-safe):
• After orienting, observe an independent check point C (not used in orientation).
• Compute the check point coordinates. If the mismatch is outside tolerance → STOP and re-orient.

Control disturbance checks:
• Inspect the peg/mark (fresh digging, construction activity, loose peg).
• If disturbed or uncertain: STOP and re-establish control before staking.

Hard stop rules:
• You cannot confirm the occupied control ID.
• Backsight/resection is inconsistent or check point fails.
• You suspect CAD/design projection mismatch (grid vs ground, wrong zone).`,
        seniorContent: `2. Set up on known control point`
      },
      {
        id: 3,
        title: 'Stake Points',
        juniorContent: `STEP 3 — STAKE EACH POINT (FIELD SOP)
Stakeout is a controlled procedure: stake → label → witness → check.

In METARDU:
→ Tools → Setting Out
→ Select target point(s)
→ Follow bearing + distance guidance (and GPS/audio if enabled)

Field staking routine (repeat for each point):
1) Confirm target point name matches the drawing schedule.
2) Move to the computed position and set the peg/mark.
3) Label immediately (point ID + date + offset notes).
4) Add a witness tie (two tape ties to permanent features if possible).
5) For critical points, set an offset peg (e.g., 1–2 m) so the point can be restored if disturbed.

Trainee mistakes to avoid:
• Staking without labels (creates chaos later).
• Using only one check (always do an independent check for critical points).
• Mixing grid vs ground coordinates without applying the project’s scale factor rules.`,
        seniorContent: `3. Use METARDU Stakeout mode. Follow bearing/distance guidance`
      },
      {
        id: 4,
        title: 'Verify',
        juniorContent: `STEP 4 — VERIFY + RECORD (FIELD SOP)
Verification is what makes you supervisor-free.

Verification options (pick at least one independent check):
• Check from a second setup: occupy another control and re-stake/check the point.
• Check an independent point: after orientation, compute coordinates of a check point not used in orientation.
• Check by measurement: measure distance/bearing from control to the staked point and compare to computed.

Tolerance handling:
• Use the project tolerance (do not assume ±20 mm for every job).
• If outside tolerance:
  1) Re-check occupation + HI/HR + prism constant.
  2) Re-check orientation (backsight/resection).
  3) Re-stake and re-check. If still failing → STOP and escalate (control/design mismatch likely).

As-staked record:
• Save the final stake coordinates and the check residuals (QA/as-built evidence).`,
        seniorContent: `4. Verify staked points. Re-measure if outside tolerance ±20mm`
      },
      {
        id: 5,
        title: 'Handover',
        juniorContent: `STEP 5 — HANDOVER (SOP)
A setting-out job is not finished until the site team can use your marks reliably.

Handover checklist:
• Walk the site with the foreman/site engineer and confirm point IDs.
• Explain offset pegs and reference marks (how to restore if disturbed).
• Provide a point schedule (ID, coordinates, description, tolerance).
• Provide “as-staked” check residuals (your QA evidence).

Trainee rule:
If marks will be disturbed by work, ALWAYS provide offsets and clear written instructions.`,
        seniorContent: `5. Hand over point schedule and offsets to the site team`
      }
    ]
  },
  'boundary': {
    title: 'Boundary Survey',
    icon: '🏡',
    fieldChecklist: [
      'Deed/plan documents confirmed for the correct parcel (ID, edition/date)',
      'Jurisdiction rules confirmed (monument type, witnessing, required forms)',
      'Neighbors/occupants notified and evidence documented (photos + notes)',
      'All found monuments photographed, described, and tied to witnesses',
      'Traverse connects to reliable control and meets precision target',
      'Any re-established monuments have offsets/ties and acknowledgments recorded',
    ],
    stopRules: [
      'Boundary dispute, threats, or conflicting monuments (do not guess)',
      'Cannot connect to reliable control / datum is uncertain',
      'Legal/administrative requirement unclear (forms/specs/authority)',
      'Evidence conflict cannot be resolved by field checks (escalate)',
    ],
    steps: [
      {
        id: 1,
        title: 'Research Title',
        juniorContent: `STEP 1 — DESK STUDY (BOUNDARY SOP)
Boundary surveying is technical + legal. Your first job is to understand what must be reinstated and what evidence is valid.

Collect documents (latest versions):
• Title deed / registry extract (parcel ID, owner, acreage/area)
• Survey plan / mutation / deed plan (bearings, distances, monument descriptions)
• Any coordinates list (beacons/control) and datum/projection notes
• Adjacent parcel IDs and any easements/road reserves

Desk checks (trainee-safe):
1) Confirm you have the correct parcel ID and correct edition/date of plan.
2) Note the monument types required by your jurisdiction (material, depth, witness marks).
3) Identify key “legal lines” (road boundaries, rivers, easements) that must be respected.
4) Prepare a corner schedule: corner IDs (P1…Pn), expected bearings/distances, expected area.

Training rule:
If evidence is unclear or the case is disputed, do NOT “guess” corners. Document and escalate early.`,
        seniorContent: `1. Obtain title deed and registered dimensions`
      },
      {
        id: 2,
        title: 'Locate Corners',
        juniorContent: `STEP 2 — LOCATE EXISTING MONUMENTS (FIELD SOP)
Your job is to recover evidence first. Reinstatement comes after evidence + checks.

Search for:
• Iron pin / rebar, concrete beacon, stone mark, old pegs
• Fence corners, hedge lines, old boundary trenches (supporting evidence)
• Reference marks described on the plan (trees, buildings, culverts)

Evidence capture routine (repeat for each found mark):
1) Confirm the mark type matches the plan description (if provided).
2) Photograph close-up and context (include a scale if possible).
3) Describe it: material, condition, any stamps/IDs.
4) Record witness ties: at least two offsets to permanent features.
5) Add it to METARDU as a control point and LOCK it.

Conflict handling (trainee-safe):
• If two monuments claim the same corner OR evidence conflicts:
  - do NOT choose one arbitrarily
  - document both, take ties, and escalate

Hard stop rules:
• Adjoining owner disputes the line or refuses access.
• Conflicting monuments cannot be resolved by checks.
• You cannot connect the recovered evidence to reliable control.`,
        seniorContent: `2. Search for and locate existing boundary markers`
      },
      {
        id: 3,
        title: 'Run Traverse',
        juniorContent: `STEP 3 — CONNECT THE EVIDENCE (TRAVERSE SOP)
You must connect all recovered corners/monuments into one consistent control framework.

Traverse strategy (recommended):
• Start from reliable control.
• Observe around the parcel connecting each corner.
• Close back to start OR to a second known control point (stronger check).

Quality requirements (Basak):
• Angles: observe FL/FR (or repeated sets).
• Perform angular check (±1' √n) before leaving.
• Precision target for boundary work: aim ≥ 1:5000 (or jurisdiction requirement).

Trainee tip:
Use consistent corner naming from the plan (P1, P2, …) to avoid legal confusion later.

If your traverse fails precision gates:
Do not proceed to reinstatement. Fix the measurement problem first.`,
        seniorContent: `3. Run closed traverse connecting all corners`
      },
      {
        id: 4,
        title: 'Verify Dimensions',
        juniorContent: `STEP 4 — VERIFY AGAINST THE REGISTER (SOP)
Now compare your measured geometry to the registered plan.

Checks:
• Bearings vs registered bearings (watch for different bearing basis: WCB vs quadrant bearings)
• Distances vs registered distances (ground vs grid considerations per jurisdiction)
• Area vs registered area (coordinate area after adjustment)

When differences appear (trainee-safe workflow):
1) Verify you used the correct parcel documents (ID + edition/date).
2) Verify datum/UTM zone/hemisphere and bearing convention.
3) Re-check instrument setup (centering, HI/HR, prism constant).
4) Re-observe the suspect leg(s) and re-run traverse adjustment.
5) If evidence conflicts remain: document and escalate (do not “force” corners).`,
        seniorContent: `4. Compare measured vs registered dimensions`
      },
      {
        id: 5,
        title: 'Mark Corners',
        juniorContent: `STEP 5 — REINSTATE / MARK MISSING CORNERS (SOP)
Only reinstate after evidence + checks are consistent.

Reinstatement routine:
1) Compute the corner position from adjusted traverse coordinates.
2) Stake the corner and set the monument to jurisdiction spec (type, depth, witness mark).
3) Set offset/witness pegs (so corner can be restored if disturbed).
4) Capture evidence:
   • photos (before/after)
   • monument description
   • two witness ties to permanent features
5) If required, obtain adjoining owner acknowledgment/witnessing.

Trainee stop gate:
If evidence is conflicting or neighbors dispute the corner, do NOT set a “new truth” monument. Escalate.`,
        seniorContent: `5. Calculate and mark any missing corners`
      },
      {
        id: 6,
        title: 'Generate Report',
        juniorContent: `STEP 6 — BOUNDARY REPORT (SOP)
Your report must explain what you found, what you reinstated, and what checks passed.

In METARDU:
→ Generate Survey Plan / Boundary Report

Minimum contents:
• Parcel ID + document references (edition/date)
• Control used (datum/UTM zone) + verification notes
• Corner schedule: coordinates, monument status (found/set), descriptions
• Bearings/distances table + area/perimeter
• Closure/precision statement + adjustment method
• Evidence log: photos list + witness ties summary
• Notes on discrepancies/conflicts and how they were handled
• Surveyor certification block (per jurisdiction)`,
        seniorContent: `6. Generate Survey Plan report for registration`
      }
    ]
  },
  'road-survey': {
    title: 'Road Survey',
    icon: '🛣️',
    steps: [
      {
        id: 1,
        title: 'Define Centerline',
        juniorContent: `STEP 1 — DEFINE CENTERLINE
Establish the road centreline.

In METARDU:
→ Create points along proposed road
→ These define the centerline alignment

Or:
• Pick up from CAD design
• Stake from existing control`,
        seniorContent: `1. Define centerline points in METARDU`
      },
      {
        id: 2,
        title: 'Create Alignment',
        juniorContent: `STEP 2 — CREATE ALIGNMENT
Build the road alignment in METARDU.

In METARDU:
→ Go to Profiles in your project
→ Create new alignment
→ Select centerline points in order

Chainage will be computed automatically.`,
        seniorContent: `2. Create alignment in project Profiles section`
      },
      {
        id: 3,
        title: 'Profile Observations',
        juniorContent: `STEP 3 — TAKE PROFILE OBSERVATIONS
Collect elevation along centerline.

At each chainage station:
1. Set up level or total station
2. Take centerline elevation
3. Take left offset + elevation
4. Take right offset + elevation

Record systematically.`,
        seniorContent: `3. Collect centerline and cross-section elevations`
      },
      {
        id: 4,
        title: 'Enter Cross Sections',
        juniorContent: `STEP 4 — ENTER IN GEONOVA
Input cross-section data.

In METARDU Profiles:
→ Select chainage station
→ Add left offset + elevation
→ Add center elevation
→ Add right offset + elevation

Repeat for all stations.`,
        seniorContent: `4. Enter cross-sections in Profiles tool`
      },
      {
        id: 5,
        title: 'Generate Outputs',
        juniorContent: `STEP 5 — GENERATE PROFILE
Create longitudinal profile and sections.

In METARDU:
→ View Longitudinal Profile
→ Export profile as image

For design:
• Export to CAD or Civil 3D
• Calculate cut/fill volumes
• Generate design grades`,
        seniorContent: `5. View profile and export for design`
      }
    ]
  },
  'control-network': {
    title: 'Control Network',
    icon: '🎯',
    steps: [
      {
        id: 1,
        title: 'Design Network',
        juniorContent: `STEP 1 — DESIGN THE NETWORK
Plan your control point locations.

Consider:
• Coverage of survey area
• Intervisibility between points
• Access for future use
• Redundancy (multiple connections)

Minimum:
• 2 known reference points
• 3+ new control points
• Multiple connections between points`,
        seniorContent: `1. Design network with 2+ references and 3+ new points`
      },
      {
        id: 2,
        title: 'Establish Stations',
        juniorContent: `STEP 2 — ESTABLISH MARKERS
Place permanent markers in the field.

Marker types:
• Concrete pillars (permanent)
• Steel pins (semi-permanent)
• Temporary marks (construction)

Mark clearly and record positions.`,
        seniorContent: `2. Place permanent markers at designed locations`
      },
      {
        id: 3,
        title: 'Observe Network',
        juniorContent: `STEP 3 — OBSERVE ALL CONNECTIONS
Measure between all points.

For each observation:
• Horizontal angle (multiple sets)
• Slope distance
• Vertical angle

Connect every point to multiple others
for redundancy.`,
        seniorContent: `3. Observe angles and distances to all points`
      },
      {
        id: 4,
        title: 'Adjust Network',
        juniorContent: `STEP 4 — ADJUST THE NETWORK
Apply least squares adjustment.

METARDU features:
• Basic traverse adjustment (Bowditch)
• Network adjustment (coming soon)

For now:
• Run closed traverses between points
• Use weighted average of multiple runs`,
        seniorContent: `4. Adjust using traverse connections between points`
      },
      {
        id: 5,
        title: 'Document & Save',
        juniorContent: `STEP 5 — DOCUMENT CONTROL
Save and report your control network.

In METARDU:
→ Mark points as Control
→ Set control_order (primary/secondary)
→ Generate report

Report should include:
• Point coordinates
• Description of markers
• Accuracy assessment`,
        seniorContent: `5. Mark as control in METARDU, generate report`
      }
    ]
  },
  'mining': {
    title: 'Mining Survey',
    icon: '⛏',
    steps: [
      {
        id: 1,
        title: 'Underground Control',
        juniorContent: `STEP 1 — ESTABLISH UNDERGROUND CONTROL
Set up control points in the mine.

Why we do this:
Underground surveys need their own control
network. Surface control isn't visible underground.

What you need:
• At least 2 control points per section
• Points in stable rock, not ore
• Permanent markers (pins, bolts)

In METARDU:
→ Create new project
→ Set survey type: Mining
→ Add control points as Primary`,
        seniorContent: `1. Establish underground control network with stable monuments`
      },
      {
        id: 2,
        title: 'Instrument Setup',
        juniorContent: `STEP 2 — SET UP IN TUNNEL
Position total station for inclined measurements.

Key points:
• Centre over control point
• Measure instrument height (HI)
• Account for tunnel clearance
• Ensure clear sight lines

For inclined traverses:
• Measure slope distance
• Measure vertical angle
• Measure horizontal angle`,
        seniorContent: `2. Set up total station, measure HI, verify sight lines`
      },
      {
        id: 3,
        title: '3D Traverse',
        juniorContent: `STEP 3 — RUN INCLINED TRAVERSE
Measure between stations with full 3D data.

In METARDU Mining Tools:
→ Select 3D Traverse
→ Enter slope distance
→ Enter vertical angle (+ or -)
→ Enter horizontal bearing
→ Calculate 3D coordinates

Formula:
HD = SD × cos(VA)
VD = SD × sin(VA)
ΔE = HD × sin(bearing)
ΔN = HD × cos(bearing)
ΔZ = VD`,
        seniorContent: `3. Run 3D inclined traverse, compute coordinates`
      },
      {
        id: 4,
        title: 'Volume Calculation',
        juniorContent: `STEP 4 — CALCULATE VOLUMES
Compute volumes from cross sections.

In METARDU Mining Tools:
→ Select Volume calculator
→ Choose method:
  - End Area (simple)
  - Prismoidal (accurate)
  - Cut/Fill (for earthworks)

Enter section areas at chainages.`,
        seniorContent: `4. Calculate volumes from cross sections using End Area or Prismoidal`
      },
      {
        id: 5,
        title: 'Subsidence Monitoring',
        juniorContent: `STEP 5 — MONITOR SUBSIDENCE
Track point movement over time.

In METARDU Mining Tools:
→ Select Subsidence Monitoring
→ Enter epoch 1 coordinates
→ Enter epoch 2 coordinates
→ Calculate 3D movement

Track:
• Vertical settlement (ΔZ)
• Horizontal movement (ΔE, ΔN)
• Total 3D displacement`,
        seniorContent: `5. Monitor subsidence between survey epochs`
      },
      {
        id: 6,
        title: 'Generate Report',
        juniorContent: `STEP 6 — MINING SURVEY REPORT
Document your survey results.

Include:
• Traverse calculations
• Volume computations
• Subsidence data
• Control point coordinates

In METARDU:
→ Export as PDF
→ Include all calculations`,
        seniorContent: `6. Generate mining survey report with all calculations`
      }
    ]
  },
  'hydrographic': {
    title: 'Hydrographic Survey',
    icon: '🌊',
    steps: [
      {
        id: 1,
        title: 'Tide Gauge Setup',
        juniorContent: `STEP 1 — SET UP TIDE GAUGE
Install and operate tide gauge.

Why we do this:
Water levels change constantly.
Soundings must be corrected to a
common datum (chart datum).

Setup:
• Install tide gauge at fixed location
• Record readings every hour
• Note time of each reading
• Mark gauge zero elevation`,
        seniorContent: `1. Install tide gauge, record regular readings`
      },
      {
        id: 2,
        title: 'Positioning System',
        juniorContent: `STEP 2 — SET UP POSITIONING
Configure GPS for boat positioning.

Options:
• RTK GPS on boat
• Total station shore setup
• Acoustic positioning

Requirements:
• Position accuracy < 1m
• Time sync with sounder
• Record fix numbers`,
        seniorContent: `2. Configure positioning system, ensure accuracy`
      },
      {
        id: 3,
        title: 'Sounding Lines',
        juniorContent: `STEP 3 — RUN SOUNDING LINES
Collect depth data along planned lines.

Planning:
• Parallel lines across survey area
• Line spacing based on requirements
• Run lines perpendicular to shore

For each fix:
• Record time
• Record position
• Record raw depth`,
        seniorContent: `3. Execute sounding survey along planned lines`
      },
      {
        id: 4,
        title: 'Data Reduction',
        juniorContent: `STEP 4 — REDUCE SOUNDINGS
Apply tidal corrections.

In METARDU Hydro Tools:
→ Enter tide gauge readings
→ Enter sounding data
→ Apply tidal correction

Formula:
Corrected Depth = Raw Depth - Tide Height

Chart Datum depth = Corrected Depth - Datum Offset`,
        seniorContent: `4. Apply tidal corrections, reduce to chart datum`
      },
      {
        id: 5,
        title: 'Generate Chart',
        juniorContent: `STEP 5 — OUTPUT RESULTS
Create bathymetric chart.

In METARDU:
→ View cross sections
→ Generate contours
→ Export to CAD/DXF

Deliverables:
• Depth soundings table
• Bathymetric contours
• Survey report`,
        seniorContent: `5. Generate bathymetric chart and survey report`
      }
    ]
  },
  'drone': {
    title: 'Drone/UAV Survey',
    icon: '🚁',
    steps: [
      {
        id: 1,
        title: 'GCP Planning',
        juniorContent: `STEP 1 — PLAN GCPS
Design Ground Control Point distribution.

Why we do this:
GCPs tie drone images to real coordinates.
Without GCPs, accuracy is poor.

Requirements:
• Minimum 5 GCPs (more = better)
• Evenly distributed across area
• In corners and centre
• Visible from air

In METARDU Drone Tools:
→ Enter survey boundary
→ Generate GCP positions
→ Export coordinates`,
        seniorContent: `1. Plan GCP distribution, minimum 5 points`
      },
      {
        id: 2,
        title: 'GCP Setting Out',
        juniorContent: `STEP 2 — PLACE GCPs
Mark GCPs on ground and measure.

Process:
• Navigate to each GCP position
• Place target (panel, paint, marker)
• Survey with total station or GNSS
• Record coordinates

Accuracy target:
• < 2cm horizontal
• < 3cm vertical`,
        seniorContent: `2. Set out GCPs, survey with total station/GNSS`
      },
      {
        id: 3,
        title: 'Flight Planning',
        juniorContent: `STEP 3 — PLAN FLIGHT
Configure drone mission.

Settings:
• Flying height (affects GSD)
• Front overlap (75-80%)
• Side overlap (60-70%)
• Grid pattern

GSD Calculator:
GSD = (sensor width × flight height) / (focal length × image width)`,
        seniorContent: `3. Configure flight mission parameters`
      },
      {
        id: 4,
        title: 'Process Data',
        juniorContent: `STEP 4 — PROCESS IMAGES
Run photogrammetry software.

Steps:
1. Import images
2. Add GCP coordinates
3. Tie points
4. Generate mesh
5. Create DEM/DSM

Software options:
• Pix4D, Agisoft, DroneDeploy`,
        seniorContent: `4. Process images with GCP constraints`
      },
      {
        id: 5,
        title: 'Accuracy Check',
        juniorContent: `STEP 5 — VERIFY ACCURACY
Compare independent check points.

In METARDU Drone Tools:
→ Enter surveyed coordinates
→ Enter drone-computed coordinates
→ Calculate RMSE
→ Check against accuracy class

Classes:
• Class I: ≤ 7.5cm / 15cm
• Class II: ≤ 15cm / 30cm
• Class III: ≤ 37.5cm / 75cm`,
        seniorContent: `5. Verify accuracy against IHO/ASPRS standards`
      }
    ]
  }
};

export default function GuideTypePage({ params }: PageProps) {
  const router = useRouter();
  const type = params.type;
  const guide = guideData[type];

  const toolLinkByGuide: Record<string, { href: string; label: string }> = {
    'closed-traverse': { href: '/tools/traverse', label: 'Open METARDU Tool → Traverse' },
    leveling: { href: '/tools/leveling', label: 'Open METARDU Tool → Leveling' },
    boundary: { href: '/tools/traverse', label: 'Open METARDU Tool → Traverse (Boundary)' },
    'setting-out': { href: '/tools/setting-out', label: 'Open METARDU Tool → Setting Out' },
    radiation: { href: '/tools/cogo', label: 'Open METARDU Tool → COGO (Radiation)' },
  }

  const toolLink = toolLinkByGuide[type] ?? { href: '/project/new', label: 'Open METARDU Tool → Create Project' }
  
  const [mode, setMode] = useState<'junior' | 'senior'>('junior');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [fieldChecklistDone, setFieldChecklistDone] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`guide_${type}_progress`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompletedSteps(data.completedSteps || []);
        if (data.mode) setMode(data.mode);
      } catch {}
    }

    const savedChecklist = localStorage.getItem(`guide_${type}_fieldChecklist`)
    if (savedChecklist) {
      try {
        const data = JSON.parse(savedChecklist)
        setFieldChecklistDone(Array.isArray(data) ? data : [])
      } catch {}
    } else {
      setFieldChecklistDone([])
    }
  }, [type]);

  const saveProgress = (steps: number[], currentMode: 'junior' | 'senior') => {
    localStorage.setItem(`guide_${type}_progress`, JSON.stringify({
      completedSteps: steps,
      mode: currentMode,
      lastUpdated: new Date().toISOString()
    }));
    
    const allProgress = JSON.parse(localStorage.getItem('guide_progress') || '{}');
    allProgress[type] = { completedSteps: steps.length };
    localStorage.setItem('guide_progress', JSON.stringify(allProgress));
  };

  const toggleStep = (stepId: number) => {
    const newCompleted = completedSteps.includes(stepId)
      ? completedSteps.filter(s => s !== stepId)
      : [...completedSteps, stepId];
    setCompletedSteps(newCompleted);
    saveProgress(newCompleted, mode);
  };

  const toggleFieldChecklist = (index: number) => {
    const next = fieldChecklistDone.includes(index)
      ? fieldChecklistDone.filter(i => i !== index)
      : [...fieldChecklistDone, index]
    setFieldChecklistDone(next)
    localStorage.setItem(`guide_${type}_fieldChecklist`, JSON.stringify(next))
  }

  if (!guide) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Guide not found</p>
          <Link href="/guide" className="text-[var(--accent)] hover:underline">
            ← Back to Guides
          </Link>
        </div>
      </div>
    );
  }

  const allComplete = completedSteps.length === guide.steps.length;

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/guide" className="text-[var(--accent)] hover:underline text-sm">
                ← Back to Guides
              </Link>
              <h1 className="text-2xl font-bold mt-2">
                {guide.icon} {guide.title}
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
                <button
                  onClick={() => setMode('junior')}
                  className={`px-3 py-1 rounded text-sm ${
                    mode === 'junior' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  👨‍🎓 Junior
                </button>
                <button
                  onClick={() => setMode('senior')}
                  className={`px-3 py-1 rounded text-sm ${
                    mode === 'senior' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  ⚡ Senior
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[var(--accent)] rounded-full transition-all"
                style={{ width: `${(completedSteps.length / guide.steps.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-[var(--text-secondary)]">
              {completedSteps.length}/{guide.steps.length} steps
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {(guide.fieldChecklist || guide.stopRules) && (
          <div className="bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)] rounded-xl p-6">
            {guide.fieldChecklist && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Field Checklist (Supervisor-Free)</h2>
                <div className="space-y-2">
                  {guide.fieldChecklist.map((item, idx) => {
                    const checked = fieldChecklistDone.includes(idx)
                    return (
                      <label key={idx} className="flex items-start gap-3 text-sm text-[var(--text-primary)] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFieldChecklist(idx)}
                          className="mt-1 h-4 w-4 accent-[var(--accent)]"
                        />
                        <span className={checked ? 'line-through text-[var(--text-muted)]' : ''}>{item}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {guide.stopRules && (
              <div>
                <h2 className="text-lg font-semibold mb-3 text-red-300">Stop Rules</h2>
                <ul className="list-disc pl-6 space-y-1 text-sm text-[var(--text-primary)]">
                  {guide.stopRules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {guide.steps.map((step, idx) => {
          const isComplete = completedSteps.includes(step.id);
          const content = mode === 'junior' ? step.juniorContent : step.seniorContent;
          
          return (
            <div
              key={step.id}
              className={`bg-[var(--bg-secondary)]/50 border rounded-xl p-6 transition-all ${
                isComplete ? 'border-green-500/30' : 'border-[var(--border-color)]'
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleStep(step.id)}
                  className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isComplete 
                      ? 'bg-green-500 border-green-500 text-black' 
                      : 'border-gray-600 hover:border-[var(--accent)]'
                  }`}
                >
                  {isComplete && '✓'}
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-[var(--text-muted)]">STEP {step.id}</span>
                    {isComplete && (
                      <span className="text-xs text-green-400">✓ Complete</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                  
                  <pre className={`whitespace-pre-wrap font-mono text-sm ${
                    mode === 'junior' ? 'text-[var(--text-primary)]' : 'text-[var(--accent)]'
                  }`}>
                    {content}
                  </pre>
                  
                  {mode === 'junior' && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                      <Link 
                        href={toolLink.href}
                        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                      >
                        <span className="text-xs">🔗</span>
                        {toolLink.label}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {allComplete && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Survey Complete!</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              You've completed the {guide.title} workflow guide.
            </p>
            <div className="flex justify-center gap-4">
              <Link 
                href="/guide"
                className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] rounded text-[var(--text-primary)]"
              >
                ← Back to Guides
              </Link>
              <Link 
                href={toolLink.href}
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] rounded text-black font-semibold"
              >
                Start in METARDU →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
