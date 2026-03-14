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

## UTM COVERAGE (GLOBAL)
- All 60 UTM zones supported (1-60)
- Both hemispheres: N (Northern) and S (Southern)
- Special zones: Norway (32V), Svalbard (31-37X) handled
- Auto-detection: from GPS coordinates
- Zone descriptions shown for common regions
- GeoNova serves surveyors globally — not just Africa

## TARGET MARKETS (in order)
1. East Africa: Kenya, Uganda, Tanzania
2. West Africa: Nigeria, Ghana
3. Southern Africa: South Africa, Mozambique
4. North Africa: Egypt, Morocco
5. South Asia: India, Bangladesh
6. Southeast Asia: Indonesia, Malaysia
7. South America: Brazil, Colombia
8. Oceania: Australia, New Zealand
9. Europe: UK, France, Germany
10. Global: everywhere else

## PRICING CURRENCIES
KES, UGX, TZS, NGN, GHS, ZAR, INR, IDR, BRL, AUD, GBP, EUR, USD
Auto-detected from user location.

## ONLINE FEATURES ROADMAP

### Phase 7 — Online Power Features
- GNSS baseline processing (upload raw files)
- Live coordinate transformation API
- Real-time weather + EDM corrections
- Online benchmark database lookup
- Satellite imagery overlay (Sentinel-2)

### Phase 8 — Integration Layer  
- Kenya NLIMS land registry integration
- Uganda NLIS integration
- Tanzania Land Registry integration
- KenCORS real-time corrections
- Digital signature + QR verification
- Equipment calibration tracker

### Phase 9 — Community + Marketplace
- Survey job marketplace (5% commission)
- Peer review network
- AI plan checking
- CPD certificate system
- Professional body integration:
  ISK, Uganda, Tanzania boards

### Phase 10 — Enterprise
- Cloud rendering for large projects
- Survey project insurance integration
- Government department licensing
- University API
- White-label for large firms

### THE KILLER WORKFLOW (target):
Field observation
  → GNSS processing (GeoNova)
  → Traverse adjustment (GeoNova)
  → Survey plan generation (GeoNova)
  → Digital signature (GeoNova)
  → Land registry submission (GeoNova)

Zero external software needed.
This is what defeats Trimble, Leica,
and AutoCAD in the African market.
