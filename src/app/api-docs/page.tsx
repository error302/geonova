/**
 * API Docs page.
 *
 * AUDIT FIX (2026-07-03): The old page documented a non-existent
 * `https://api.metardu.app/v1/*` API with fabricated rate limits.
 * METARDU doesn't have a versioned public REST API — it has internal
 * Next.js API routes at `/api/*` on the same domain as the web app.
 *
 * This rewrite documents the REAL API surface: actual `/api/*` routes
 * grouped by domain, with honest notes about authentication.
 */

const API_GROUPS = [
  {
    title: 'Coordinate Transformation',
    routes: [
      { method: 'POST', path: '/api/geo/transform', desc: 'Transform coordinates between CRS (WGS84, UTM, Arc 1960, Cassini-Soldner). Bursa-Wolf datum shifts.' },
      { method: 'POST', path: '/api/convert-datum', desc: 'Convert between datums (WGS84 ↔ Arc 1960). Wrapper around the geo transform engine.' },
      { method: 'POST', path: '/api/coordinates/transform', desc: 'Alternative coordinate transform endpoint.' },
      { method: 'POST', path: '/api/coordinates/batch', desc: 'Batch transform up to 5,000 coordinates.' },
    ],
  },
  {
    title: 'Survey Points',
    routes: [
      { method: 'GET', path: '/api/survey-points?project_id=X', desc: 'List all survey points for a project.' },
      { method: 'POST', path: '/api/survey-points', desc: 'Create one or more survey points (bulk import). Used by field collect sync.' },
      { method: 'PATCH', path: '/api/survey-points/[id]', desc: 'Update a survey point with optimistic locking.' },
      { method: 'GET', path: '/api/project/[id]/points', desc: 'Get project points with CRS/accuracy/provenance metadata.' },
    ],
  },
  {
    title: 'Projects',
    routes: [
      { method: 'GET', path: '/api/projects', desc: 'List the authenticated user\'s projects.' },
      { method: 'POST', path: '/api/projects', desc: 'Create a new project.' },
      { method: 'GET', path: '/api/projects/[id]', desc: 'Get project details.' },
      { method: 'POST', path: '/api/projects/[id]/approve', desc: 'Approve & lock a project (licensed surveyors only). Computes SHA-256 cryptographic seal.' },
      { method: 'POST', path: '/api/projects/[id]/parcels/batch', desc: 'Bulk import parcels with vertices.' },
    ],
  },
  {
    title: 'Document Generation',
    routes: [
      { method: 'POST', path: '/api/deed-plan/generate', desc: 'Generate a deed plan (Form No. 4) PDF.' },
      { method: 'POST', path: '/api/sign-plan', desc: 'Generate a digitally signed survey plan PDF.' },
      { method: 'POST', path: '/api/survey-plan/export/dxf', desc: 'Export survey plan as DXF.' },
      { method: 'GET', path: '/api/project/[id]/export/ifc', desc: 'Export project data as IFC4.' },
      { method: 'POST', path: '/api/submission/generate', desc: 'Generate a submission document.' },
      { method: 'POST', path: '/api/submission/assemble', desc: 'Assemble a full submission package (ZIP).' },
      { method: 'POST', path: '/api/submissions/create', desc: 'Create a submission record (returns submission number).' },
    ],
  },
  {
    title: 'GNSS',
    routes: [
      { method: 'POST', path: '/api/gnss/baseline-process', desc: 'Process GNSS baseline via RTKLIB subprocess.' },
      { method: 'POST', path: '/api/gnss/process', desc: 'GNSS network processing.' },
    ],
  },
  {
    title: 'Spatial Index',
    routes: [
      { method: 'GET', path: '/api/spatial-index?west=&south=&east=&north=', desc: 'Viewport query — returns GeoJSON features (parcels, beacons, field records) in a WGS84 bounding box.' },
    ],
  },
  {
    title: 'Land Registry',
    routes: [
      { method: 'GET', path: '/api/nlims/lookup?parcel=X&county=Y', desc: 'Look up a parcel in personal vault, shared vault, NLIMS cache, or live NLIMS API.' },
      { method: 'GET', path: '/api/benchmarks/search?query=X', desc: 'Search for benchmarks by name or location.' },
      { method: 'GET', path: '/api/benchmarks/nearby?lat=X&lon=Y', desc: 'Find benchmarks near a coordinate.' },
    ],
  },
  {
    title: 'Weather & EDM',
    routes: [
      { method: 'GET', path: '/api/weather?lat=X&lon=Y', desc: 'Get current weather for a location.' },
      { method: 'POST', path: '/api/weather/edm-correction', desc: 'Compute atmospheric correction parameters for EDM distance measurement.' },
    ],
  },
  {
    title: 'Engineering',
    routes: [
      { method: 'POST', path: '/api/engineering/compute/volume', desc: 'Compute earthwork volume.' },
      { method: 'POST', path: '/api/engineering/compute/curve', desc: 'Compute horizontal curve geometry.' },
      { method: 'POST', path: '/api/engineering/compute/vertical-curve', desc: 'Compute vertical curve with AASHTO K-factor compliance.' },
      { method: 'POST', path: '/api/engineering/stations', desc: 'Save cross-section station data.' },
      { method: 'POST', path: '/api/engineering/vips', desc: 'Save vertical intersection points.' },
    ],
  },
  {
    title: 'Marketplace',
    routes: [
      { method: 'GET', path: '/api/marketplace/listings', desc: 'Browse equipment listings (guests allowed).' },
      { method: 'POST', path: '/api/marketplace/listings', desc: 'Create a listing (Pro subscription required).' },
      { method: 'POST', path: '/api/marketplace/inquiries', desc: 'Send an inquiry to a listing.' },
    ],
  },
  {
    title: 'Payments',
    routes: [
      { method: 'POST', path: '/api/payments/mpesa/initiate', desc: 'Initiate M-Pesa STK Push.' },
      { method: 'POST', path: '/api/payments/mpesa/callback', desc: 'M-Pesa callback handler (called by Safaricom).' },
      { method: 'POST', path: '/api/payments', desc: 'Create a payment intent (Stripe/PayPal).' },
      { method: 'POST', path: '/api/webhooks/stripe', desc: 'Stripe webhook handler.' },
      { method: 'POST', path: '/api/webhooks/paypal', desc: 'PayPal webhook handler.' },
    ],
  },
]

const methodColors: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PATCH: 'text-yellow-400',
  PUT: 'text-yellow-400',
  DELETE: 'text-red-400',
}

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">METARDU API Reference</h1>
        <p className="text-[var(--text-muted)] mb-8">
          Internal API routes for the METARDU web application. All routes are served from the same domain
          as the web app (e.g., <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded">metardu.space/api/...</code>).
        </p>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-300 mb-2">Authentication</h2>
          <p className="text-blue-200/80 text-sm mb-3">
            All routes (except webhooks and the public health check) require an authenticated NextAuth session.
            Pass cookies with <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded">credentials: 'include'</code> in fetch calls.
            There is no separate API key system — METARDU is a session-based web app, not a public REST API.
          </p>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
            <p className="text-sm text-[var(--text-muted)] mb-1">Example</p>
            <pre className="text-green-400 text-sm overflow-x-auto">
{`fetch('/api/geo/transform', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    fromCRS: 'EPSG:4326',
    toCRS: 'EPSG:21037',
    points: [{ id: '1', x: 36.817, y: -1.286 }]
  })
})`}
            </pre>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-yellow-300 mb-2">Rate Limiting</h2>
          <p className="text-yellow-200/80 text-sm">
            Most routes enforce <strong>60 requests per minute</strong> per user. Bulk import routes
            are limited to <strong>10 requests per minute</strong>. Rate limits are configured per-route
            in the <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded">apiHandler()</code> wrapper.
          </p>
        </div>

        <div className="space-y-8">
          {API_GROUPS.map((group) => (
            <div key={group.title} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">{group.title}</h2>
              <div className="space-y-3">
                {group.routes.map((route) => (
                  <div key={route.path} className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <span className={`font-mono text-sm font-bold shrink-0 ${methodColors[route.method] || 'text-[var(--text-muted)]'}`}>
                      {route.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <code className="text-sm text-[var(--text-primary)] break-all">{route.path}</code>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{route.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 mt-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Error Handling</h2>
          <p className="text-[var(--text-muted)] mb-4 text-sm">
            All routes return standard HTTP status codes. Error responses follow the shape:
          </p>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 overflow-x-auto">
            <pre className="text-red-400 text-sm">
{`{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": { ... }
}`}
            </pre>
          </div>
          <p className="text-[var(--text-muted)] mt-4 text-sm">
            Common status codes: <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded">200</code> success,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">201</code> created,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">400</code> bad request,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">401</code> unauthorized,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">403</code> forbidden,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">404</code> not found,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">409</code> conflict,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">429</code> rate limited,
            <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded ml-1">500</code> server error.
          </p>
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-8 text-center">
          These are internal API routes for the METARDU web application. A public REST API with API keys
          may be added in the future — it does not exist today.
        </p>
      </div>
    </div>
  )
}
