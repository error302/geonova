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

const guideData: { [key: string]: { title: string; icon: string; steps: Step[] } } = {
  'closed-traverse': {
    title: 'Closed Traverse',
    icon: '🔗',
    steps: [
      {
        id: 1,
        title: 'Reconnaissance',
        juniorContent: `STEP 1 — RECONNAISSANCE
Before measuring anything, walk the site.

Why we do this:
You need to see all stations clearly from 
each other. If two stations can't see each 
other, your traverse won't work.

Checklist:
□ Walk between each planned station
□ Confirm clear line of sight
□ Note any obstacles
□ Mark station positions with pegs or paint

Common mistake:
Choosing stations behind trees or buildings
where the instrument can't see the next point.`,
        seniorContent: `1. Reconnaissance — confirm intervisibility between all stations`
      },
      {
        id: 2,
        title: 'Establish Control',
        juniorContent: `STEP 2 — ESTABLISH CONTROL
You must start from at least 2 known points.

Why we do this:
Without known control points your survey
has no reference. It floats in space.

What you need:
• Opening control point (known E, N)
• Closing control point (different known E, N)
• Known bearing between them

In GeoNova:
→ Go to your project
→ Add both control points
→ Mark them as Primary Control
→ Lock them so they can't be moved`,
        seniorContent: `2. Establish 2+ known control points in GeoNova as Primary Control`
      },
      {
        id: 3,
        title: 'Set Up Instrument',
        juniorContent: `STEP 3 — SET UP INSTRUMENT
Centre the total station over your first station.

Steps:
1. Set up tripod over station mark
2. Attach total station
3. Centre using optical plummet
4. Level using plate bubble
5. Fine level using electronic level
6. Record instrument height (HI)

Check:
Rotate instrument 360° — bubble must 
stay centred throughout.`,
        seniorContent: `3. Set up instrument, record HI, centre over first station`
      },
      {
        id: 4,
        title: 'Measure Observations',
        juniorContent: `STEP 4 — MEASURE ANGLES AND DISTANCES
Observe each traverse leg.

For each leg:
1. Backsight to previous station
2. Set horizontal circle to 0°00'00"
3. Foresight to next station
4. Record horizontal angle
5. Measure slope distance
6. Record prism height (HR)

Best practice (Basak):
Take Face Left and Face Right readings.
Average them to eliminate instrument error.

In GeoNova:
→ Run Traverse → Open type → Link
→ Enter each leg bearing and distance`,
        seniorContent: `4. FL + FR observations each leg. Enter in GeoNova Traverse tool`
      },
      {
        id: 5,
        title: 'Compute Traverse',
        juniorContent: `STEP 5 — COMPUTE TRAVERSE IN GEONOVA
Upload your observations and let GeoNova compute.

What GeoNova does automatically:
✓ Computes latitudes and departures
✓ Calculates misclosure
✓ Applies Bowditch adjustment
✓ Computes adjusted coordinates
✓ Checks precision ratio
✓ Grades the traverse

Acceptable precision (Basak standards):
Urban cadastral:  1:5,000 minimum
Suburban:         1:3,000 minimum
Rural:            1:1,000 minimum

If precision is POOR:
→ Check for blunders (GeoNova flags them)
→ Re-measure the flagged leg
→ Re-run the traverse`,
        seniorContent: `5. Run traverse in GeoNova. Check precision ≥ 1:3000`
      },
      {
        id: 6,
        title: 'Generate Report',
        juniorContent: `STEP 6 — GENERATE REPORT
Your traverse is complete.

In GeoNova:
→ Click Generate Report
→ PDF downloads automatically

Report contains:
✓ Project details
✓ Control point coordinates
✓ Full Gale's Table
✓ Bowditch corrections
✓ Adjusted coordinates
✓ Precision ratio and grade

Submit this report to your client or
upload to the land registry.`,
        seniorContent: `6. Generate Report in GeoNova and submit`
      }
    ]
  },
  'leveling': {
    title: 'Leveling Run',
    icon: '📊',
    steps: [
      {
        id: 1,
        title: 'Plan the Run',
        juniorContent: `STEP 1 — PLAN THE LEVELING RUN
Determine your route and turning points.

Why we do this:
Leveling requires a systematic approach.
Poor planning leads to errors and wasted time.

Checklist:
□ Identify start point with known RL
□ Identify end point (or close back to start)
□ Plan turning points (TPs) every 50-80m
□ Ensure TPs are stable and visible`,
        seniorContent: `1. Plan route: start RL → turning points → end RL`
      },
      {
        id: 2,
        title: 'Set Up Level',
        juniorContent: `STEP 2 — SET UP THE LEVEL
Position the instrument midway between points.

Rules:
• Keep sight distances equal (within 10m)
• Never let sight distance exceed 100m
• Keep instrument stable and level

In GeoNova:
→ Create a new project or use existing
→ You'll enter BS/FS readings in the tool`,
        seniorContent: `2. Set up level midway between points, equal distances`
      },
      {
        id: 3,
        title: 'Take Readings',
        juniorContent: `STEP 3 — TAKE READINGS
Record BS and FS at each station.

For each setup:
1. Backsight (BS) to TP or start point
2. Record the reading
3. Foresight (FS) to next TP
4. Record the reading
5. Move to next setup

Important:
• Keep rod vertical (use rod level)
• Record all readings to 3 decimal places
• Check arithmetic: BS - FS should equal rise/fall`,
        seniorContent: `3. Take BS and FS readings. Record to 3 decimal places`
      },
      {
        id: 4,
        title: 'Compute in GeoNova',
        juniorContent: `STEP 4 — COMPUTE IN GEONOVA
Enter your readings and let GeoNova process.

GeoNova checks:
✓ Arithmetic check (ΣBS - ΣFS = Last RL - First RL)
✓ Cumulative error calculation
✓ Precision grade

If arithmetic check FAILS:
→ Review your readings
→ Check for transcription errors
→ Re-level if necessary`,
        seniorContent: `4. Enter in GeoNova Leveling tool. Check arithmetic passes`
      },
      {
        id: 5,
        title: 'Generate Report',
        juniorContent: `STEP 5 — GENERATE REPORT
Your leveling run is complete.

In GeoNova:
→ Generate Report
→ PDF includes:
  • Rise and Fall table
  • Check line calculations
  • Final RLs
  
If precision is poor (±12√K mm for ordinary):
→ Consider re-running the section
→ Check instrument collimation`,
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
  unknown (will need resection)`,
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
"corner_fence", "road_edge")`,
        seniorContent: `3. Record bearing and distance to each point`
      },
      {
        id: 4,
        title: 'Process Data',
        juniorContent: `STEP 4 — PROCESS IN GEONOVA
Enter observations in Radiation mode.

In GeoNova:
→ COGO Tools → Radiation
→ Enter station coordinates
→ Enter bearing and distance for each point
→ Coordinates are computed automatically

For multiple stations:
→ Use Radiation from each station
→ Points will have multiple observations`,
        seniorContent: `4. Enter in GeoNova COGO → Radiation. Get coordinates`
      }
    ]
  },
  'setting-out': {
    title: 'Setting Out',
    icon: '📍',
    steps: [
      {
        id: 1,
        title: 'Prepare Data',
        juniorContent: `STEP 1 — PREPARE DESIGN DATA
Have your design coordinates ready.

In GeoNova:
→ Add your design points first
→ Or import from CAD/DXF
→ Ensure all coordinates are in correct system`,
        seniorContent: `1. Prepare design coordinates in GeoNova project`
      },
      {
        id: 2,
        title: 'Establish Control',
        juniorContent: `STEP 2 — ESTABLISH CONTROL
Set up on a known point.

Options:
• Occupy known control point
• Or establish temporary control from nearby points

Record your setup point coordinates
accurately — all setting out depends on this!`,
        seniorContent: `2. Set up on known control point`
      },
      {
        id: 3,
        title: 'Stake Points',
        juniorContent: `STEP 3 — STAKE EACH POINT
Use GeoNova's Stakeout mode.

In GeoNova:
→ Open your project
→ Click Stakeout All Points
→ Follow the guidance screen:
  • Shows bearing to point
  • Shows distance to travel
  • Audio beeps as you approach

Common practice:
• Mark with pegs or paint
• Label clearly
• Double-check critical dimensions`,
        seniorContent: `3. Use GeoNova Stakeout mode. Follow bearing/distance guidance`
      },
      {
        id: 4,
        title: 'Verify',
        juniorContent: `STEP 4 — VERIFY STAKED POINTS
Measure back to confirm accuracy.

Check:
• Re-occupy setup point
• Measure to each staked point
• Compare with design coordinates
• Tolerance: typically ±20mm for construction

If outside tolerance:
• Re-check setup
• Re-stake if necessary`,
        seniorContent: `4. Verify staked points. Re-measure if outside tolerance ±20mm`
      }
    ]
  },
  'boundary': {
    title: 'Boundary Survey',
    icon: '🏡',
    steps: [
      {
        id: 1,
        title: 'Research Title',
        juniorContent: `STEP 1 — RESEARCH TITLE DEED
Obtain and study the registered documents.

What to find:
• Parcel dimensions from deed
• Registered bearings and distances
• Adjoining owners
• Any easements or restrictions

Check with:
• Land Registry
• Survey Office
• Physical title deeds`,
        seniorContent: `1. Obtain title deed and registered dimensions`
      },
      {
        id: 2,
        title: 'Locate Corners',
        juniorContent: `STEP 2 — LOCATE EXISTING CORNERS
Find physical markers on ground.

Search for:
• Iron pins
• Concrete monuments
• Stone markers
• Old fence posts

Use metal detector if needed.
Mark any found corners clearly.`,
        seniorContent: `2. Search for and locate existing boundary markers`
      },
      {
        id: 3,
        title: 'Run Traverse',
        juniorContent: `STEP 3 — CONNECT CORNERS
Run traverse connecting all corners.

Steps:
1. Set up on known control or corner
2. Observe to next corner
3. Record distances and angles
4. Close back to start or to another known point

Precision target: 1:5000 minimum`,
        seniorContent: `3. Run closed traverse connecting all corners`
      },
      {
        id: 4,
        title: 'Verify Dimensions',
        juniorContent: `STEP 4 — VERIFY REGISTERED DIMENSIONS
Compare measured to registered.

Check:
• Each leg bearing matches deed
• Each leg distance matches deed
• Total area matches registered

Discrepancies:
• Small differences: note in report
• Large differences: investigate further`,
        seniorContent: `4. Compare measured vs registered dimensions`
      },
      {
        id: 5,
        title: 'Mark Corners',
        juniorContent: `STEP 5 — MARK MISSING CORNERS
Place markers where none exist.

If corners are missing:
• Calculate position from adjacent corners
• Stake the position
• Get adjoining owner acknowledgment if possible

Mark with permanent markers.`,
        seniorContent: `5. Calculate and mark any missing corners`
      },
      {
        id: 6,
        title: 'Generate Report',
        juniorContent: `STEP 6 — GENERATE BOUNDARY REPORT
Produce survey report for registration.

In GeoNova:
→ Generate Survey Plan
→ Include:
  • All corner coordinates
  • Bearings and distances
  • Area and perimeter
  • Comparison with title
  • Surveyor's certification`,
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

In GeoNova:
→ Create points along proposed road
→ These define the centerline alignment

Or:
• Pick up from CAD design
• Stake from existing control`,
        seniorContent: `1. Define centerline points in GeoNova`
      },
      {
        id: 2,
        title: 'Create Alignment',
        juniorContent: `STEP 2 — CREATE ALIGNMENT
Build the road alignment in GeoNova.

In GeoNova:
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

In GeoNova Profiles:
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

In GeoNova:
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

GeoNova features:
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

In GeoNova:
→ Mark points as Control
→ Set control_order (primary/secondary)
→ Generate report

Report should include:
• Point coordinates
• Description of markers
• Accuracy assessment`,
        seniorContent: `5. Mark as control in GeoNova, generate report`
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

In GeoNova:
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

In GeoNova Mining Tools:
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

In GeoNova Mining Tools:
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

In GeoNova Mining Tools:
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

In GeoNova:
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

In GeoNova Hydro Tools:
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

In GeoNova:
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

In GeoNova Drone Tools:
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

In GeoNova Drone Tools:
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
  
  const [mode, setMode] = useState<'junior' | 'senior'>('junior');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`guide_${type}_progress`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompletedSteps(data.completedSteps || []);
        if (data.mode) setMode(data.mode);
      } catch {}
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

  if (!guide) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Guide not found</p>
          <Link href="/guide" className="text-[#E8841A] hover:underline">
            ← Back to Guides
          </Link>
        </div>
      </div>
    );
  }

  const allComplete = completedSteps.length === guide.steps.length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/guide" className="text-[#E8841A] hover:underline text-sm">
                ← Back to Guides
              </Link>
              <h1 className="text-2xl font-bold mt-2">
                {guide.icon} {guide.title}
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setMode('junior')}
                  className={`px-3 py-1 rounded text-sm ${
                    mode === 'junior' ? 'bg-[#E8841A] text-black' : 'text-gray-400'
                  }`}
                >
                  👨‍🎓 Junior
                </button>
                <button
                  onClick={() => setMode('senior')}
                  className={`px-3 py-1 rounded text-sm ${
                    mode === 'senior' ? 'bg-[#E8841A] text-black' : 'text-gray-400'
                  }`}
                >
                  ⚡ Senior
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#E8841A] rounded-full transition-all"
                style={{ width: `${(completedSteps.length / guide.steps.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-400">
              {completedSteps.length}/{guide.steps.length} steps
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {guide.steps.map((step, idx) => {
          const isComplete = completedSteps.includes(step.id);
          const content = mode === 'junior' ? step.juniorContent : step.seniorContent;
          
          return (
            <div
              key={step.id}
              className={`bg-gray-900/50 border rounded-xl p-6 transition-all ${
                isComplete ? 'border-green-500/30' : 'border-gray-800'
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleStep(step.id)}
                  className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isComplete 
                      ? 'bg-green-500 border-green-500 text-black' 
                      : 'border-gray-600 hover:border-[#E8841A]'
                  }`}
                >
                  {isComplete && '✓'}
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">STEP {step.id}</span>
                    {isComplete && (
                      <span className="text-xs text-green-400">✓ Complete</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                  
                  <pre className={`whitespace-pre-wrap font-mono text-sm ${
                    mode === 'junior' ? 'text-gray-300' : 'text-[#E8841A]'
                  }`}>
                    {content}
                  </pre>
                  
                  {mode === 'junior' && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <Link 
                        href="/project/new"
                        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#E8841A] transition-colors"
                      >
                        <span className="text-xs">🔗</span>
                        Use GeoNova Tool → Create Project
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
            <p className="text-gray-400 mb-4">
              You've completed the {guide.title} workflow guide.
            </p>
            <div className="flex justify-center gap-4">
              <Link 
                href="/guide"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-200"
              >
                ← Back to Guides
              </Link>
              <Link 
                href="/project/new"
                className="px-4 py-2 bg-[#E8841A] hover:bg-[#d67715] rounded text-black font-semibold"
              >
                Start Survey in GeoNova →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
