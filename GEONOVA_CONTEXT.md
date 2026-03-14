# GeoNova — Survey Calculation Platform

## Project Overview
- **Stack**: Next.js 14, Supabase, Leaflet, Tailwind CSS
- **Deployment**: Vercel
- **Database**: Supabase (PostgreSQL)

## Database Schema

### Tables

**projects**
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- name (text)
- location (text, nullable)
- utm_zone (integer)
- hemisphere ('N' | 'S')
- created_at (timestamp)

**survey_points**
- id (uuid, PK)
- project_id (uuid, FK)
- name (text)
- easting (float8)
- northing (float8)
- elevation (float8, nullable)
- is_control (boolean)
- control_order (text: 'primary' | 'secondary' | 'temporary')
- locked (boolean)
- created_at (timestamp)

## CALCULATION STANDARDS (MANDATORY)
Based on N.N. Basak — Surveying and Levelling

### Precision Rules
1. NEVER round intermediate values during calculation
   Carry full floating point precision through every step
   Round ONLY at the final output display

2. Trig functions (sin, cos, tan) must use full 
   JavaScript floating point precision
   Never truncate to 4dp mid-calculation

3. Final display precision:
   - Distances: 2 decimal places (e.g. 343.39 m)
   - Coordinates: 4 decimal places (e.g. 484500.0000 m)
   - Bearings: DDD°MM'SS.SSS" (e.g. 082°12'00.000")
   - Areas: m²(4dp) / ha(6dp) / acres(4dp)
   - Angles: degrees, minutes, seconds separately
   - Precision ratio: integer (e.g. 1 : 12500)

4. Bearing convention: Whole Circle Bearing (WCB)
   0° to 360° measured clockwise from North
   NEVER use decimal degrees in final output
   ALWAYS convert to DDD°MM'SS.SSS"

5. Latitude = Distance × cos(WCB)
   Departure = Distance × sin(WCB)
   Signs follow quadrant:
   NE: Lat+, Dep+
   SE: Lat-, Dep+
   SW: Lat-, Dep-
   NW: Lat+, Dep-

6. Every calculation MUST show:
   Step 1: Formula
   Step 2: Substitution with actual values
   Step 3: Result (full precision)
   Step 4: Arithmetic check

### Traverse Standards (Basak)
- Bowditch correction per leg:
  corrE = -(leg.distance/totalDistance) × closingErrorE
  corrN = -(leg.distance/totalDistance) × closingErrorN

- Precision grades:
  1:5000+ = Excellent (urban cadastral)
  1:3000+ = Good (suburban)
  1:1000+ = Acceptable (rural)
  <1:1000 = Poor (rejected)

- Angular misclosure limit: ±1' √n
  where n = number of traverse stations

- Linear misclosure limit:
  Urban:    1:5000 minimum
  Suburban: 1:3000 minimum
  Rural:    1:1000 minimum

### Leveling Standards (Basak)
- Arithmetic check MUST pass before showing results:
  Sum of BS - Sum of FS = Last RL - First RL
  If check fails: show error, do not display results

- Allowable misclosure:
  Ordinary leveling: ±12√K mm (K in km)
  Precise leveling:  ±6√K mm

### Coordinate Standards
- UTM conversion uses full ellipsoid math
  Never use simplified flat-earth approximation
- Always pass: { easting, northing, zone, hemisphere }
- Hemisphere S: false northing = 10,000,000 m
- Round-trip accuracy: < 1mm

### Display Format Examples
CORRECT:
  Distance: 343.39 m
  Bearing: 082°12'00.000"
  Area: 2354.7200 m² / 0.235472 ha / 0.581944 acres
  Precision: 1 : 12,500

WRONG:
  Distance: 343.5 m (premature rounding)
  Bearing: 82.2° (decimal degrees)
  Area: 0.24 ha (insufficient precision)
  Precision: 1/12500 (wrong format)
