# GeoNova

Professional surveying calculation platform for land surveyors - the complete replacement for expensive software like Trimble, Leica, and AutoCAD.

## Why GeoNova?

Surveying is mentally exhausting. Long days collecting observations, hours of manual computation, misclosure checks, and report writing. GeoNova handles everything so you can focus on what matters - taking accurate observations.

## Features

### Core Survey Tools (18+)
- **Distance & Bearing** - Point-to-point calculations
- **Bearing Calculator** - WCB ↔ Quadrant conversion
- **Area Calculator** - Coordinate, trapezoidal, Simpson's methods
- **Traverse** - Closed, open, link traverse with Bowditch/Transit adjustment
- **Leveling** - Rise & Fall, Height of Collimation
- **COGO** - Radiation, bearing intersection, distance intersection, resection
- **Curves** - Circular curve elements and stakeout
- **Tacheometry** - Stadia calculations
- **Chainage** - Station chaining
- **GNSS** - Coordinate handling
- **Mining Survey** - Underground calculations
- **Hydrographic** - Bathymetric surveys
- **Drone/UAV** - Flight planning & GCP
- **Setting Out** - Stakeout calculations
- **Two-Peg Test** - Instrument calibration
- **Missing Line** - Triangle calculations
- **Grade/Slope** - Gradient calculations

### Online Services (Phase 7)
- GNSS baseline file processing
- Live coordinate transformation API (WGS84 ↔ UTM, all 60 zones)
- Real-time weather/EDM corrections
- Benchmark database lookup
- Satellite imagery overlay (Sentinel-2)

### Integration Layer (Phase 8)
- Kenya NLIMS land registry
- Uganda NLIS
- Tanzania Land Registry
- Ghana, Nigeria, South Africa registries
- Kenya CORS (RTK corrections)
- Digital signature + QR verification
- Equipment calibration tracker
- International registries (India, Bangladesh, Indonesia, Malaysia, Brazil, Colombia, Egypt, Morocco)

### Community + Marketplace (Phase 9)
- Survey job marketplace (5% commission)
- Peer review network
- AI plan checking
- CPD certificate system
- Professional body integration (ISK, Uganda, Tanzania boards)
- Survey templates store
- Find professional surveyors

### Enterprise (Phase 10)
- Cloud rendering for large projects
- Survey project insurance
- Government department licensing
- University API
- White-label configuration
- Audit logs
- Payment integration (M-Pesa, Card, PayPal)

### Land Law Intelligence (Phase 11)
- Legal guidance based on Brown's Boundary Control
- Boundary dispute procedures
- Adverse possession rules
- Easement guidance

### Data Management
- Supabase realtime collaboration
- Offline field book with sync
- Import: RINEX, Topcon, Leica SDR, JobXML, GSI
- Export: GeoJSON, LandXML, DXF, PDF reports

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Leaflet (maps)
- Capacitor (Android mobile)
- PWA support (works offline)

## Supported

- **14 Languages**: EN, SW, FR, AR, PT, ES, ZH, JA, RU, HI, ID, AM, HA, DE
- **60 UTM Zones**: All zones, both hemispheres
- **13 Currencies**: KES, UGX, TZS, NGN, GHS, ZAR, INR, IDR, BRL, AUD, GBP, EUR, USD

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Build mobile app (requires Java)
npm run mobile:build
```

## Pages

- `/` - Landing page
- `/tools/*` - 19 survey tools
- `/project/[id]` - Project workspace
- `/fieldbook` - Digital field book
- `/community` - Surveyor community
- `/marketplace` - Templates & services
- `/jobs` - Job board
- `/online` - Coordinate services
- `/parcel` - Parcel search
- `/kencors` - RTK corrections
- `/checkout` - Payment
- `/analytics` - Usage analytics
- `/notifications` - Activity center
- `/audit-logs` - Security logs
- `/white-label` - Enterprise branding
- `/api-docs` - API documentation
- `/cpd` - CPD certificates
- `/ai-plan-checker` - AI validation
- `/peer-review` - Professional reviews

## Build

- **Web**: 67 routes, builds successfully
- **Mobile**: Capacitor Android (requires Java for APK build)

## License

MIT

---

Built for African surveyors, by understanding their challenges.
