# API Design Conventions — v0.3

Per `api-design-principles` + `nodejs-backend-patterns` skills.

## Route grammar

All API routes live under `/api/v1/` (versioned from day one).

```
GET    /api/v1/{resource}                    list (paginated)
POST   /api/v1/{resource}                    create
GET    /api/v1/{resource}/{id}               get one
PATCH  /api/v1/{resource}/{id}               partial update
PUT    /api/v1/{resource}/{id}               full replace
DELETE /api/v1/{resource}/{id}               delete

POST   /api/v1/{resource}/{id}/{action}      non-CRUD action (e.g. compute, export)
```

**Rules:**
- Resources are **plural nouns** (`/api/v1/projects`, not `/api/v1/project`)
- Actions on resources use a sub-path: `/api/v1/calculators/traverse/adjust`
- **Never** use verbs in the resource path (`/api/v1/getProjects` → wrong)
- HTTP methods carry the action; the URL identifies the resource

## Calculator endpoints

The 40+ surveying calculators are **resources with a `/compute` action**:

```
POST /api/v1/calculators/traverse/adjust         Bowditch/Transit
POST /api/v1/calculators/leveling/close          Rise & Fall
POST /api/v1/calculators/cogo/radiation          Radiation
POST /api/v1/calculators/cogo/intersection       Intersection
POST /api/v1/calculators/cogo/resection          Resection
POST /api/v1/calculators/curves/horizontal       Horizontal curve geometry
POST /api/v1/calculators/volumes/prismoidal      Prismoidal volume
POST /api/v1/calculators/volumes/end-area        End-area volume
POST /api/v1/calculators/coordinates/transform   WGS84 ↔ UTM
```

**Why POST, not GET:** calculator inputs are often large (e.g. 50-station traverse) and complex (nested objects). POST body is the right place. Results are deterministic but the input isn't cacheable via URL.

**Caching:** since calculators are deterministic, cache results server-side by hash of inputs. Redis key: `calc:traverse:${sha256(JSON.stringify(input))}`, TTL = infinite (until schema changes). See Phase 5 system-design doc.

## Error envelope

Two coexisting shapes — use v3 for new routes:

### v0.3 (structured — preferred for new routes)

```ts
// Success
{ data: T, error: null, meta?: { nextCursor, hasMore, limit } }

// Error
{ data: null, error: { code: 'VALIDATION_ERROR', message: '...', details: {...} }, meta?: {} }
```

`code` is SCREAMING_SNAKE_CASE. Common codes:
- `VALIDATION_ERROR` (422) — Zod parse failed, see `details.issues`
- `UNAUTHORIZED` (401) — no session
- `FORBIDDEN` (403) — wrong role
- `NOT_FOUND` (404)
- `CONFLICT` (409) — duplicate, optimistic lock mismatch
- `RATE_LIMIT_EXCEEDED` (429) — see `details.retryAfter`
- `INTERNAL_ERROR` (500)
- Domain-specific: `TRAVERSE_MISCLOSE_EXCEEDED`, `PROJECT_NOT_FOUND`, etc.

### Legacy (string error — existing routes)

```ts
{ data: T | null, error: string | null, meta?: {} }
```

Kept for backward compat. Existing 200+ routes keep working. Migrate opportunistically.

## Pagination

Cursor-based for list endpoints:

```
GET /api/v1/projects?cursor=abc123&limit=20

→ 200 OK
{
  data: [...],
  error: null,
  meta: {
    nextCursor: "def456",   // null when no more pages
    hasMore: true,
    limit: 20
  }
}
```

Use `paginateMeta()` from `@/lib/api/response` to build the meta.

## Validation

Every Route Handler validates input with Zod at the boundary:

```ts
import { z } from 'zod'
import { apiHandler } from '@/lib/api/handler'

const traverseAdjustSchema = z.object({
  stations: z.array(z.object({
    name: z.string(),
    bearing: z.string().regex(/^\d{1,3}°\d{2}'\d{2}"$/),
    distance: z.number().positive(),
  })),
  method: z.enum(['bowditch', 'transit']),
})

export const POST = apiHandler({
  requireAuth: true,
  schema: traverseAdjustSchema,
  handler: async (ctx) => {
    const result = await adjustTraverse(ctx.input)
    return NextResponse.json(apiSuccessV3(result))
  },
})
```

## Rate limiting

- Auth endpoints (login, register, password-reset): 5 attempts / 15 min / IP
- Calculator endpoints: 60 / min / user
- List/read endpoints: 300 / min / user

Configured via `rateLimit` option on `apiHandler`.

## Health checks

- `GET /api/health/live` — process alive (no deps)
- `GET /api/health/ready` — deps connected (DB check)

Used by Docker, PM2, and orchestrators.

## Offline-first

Client-side mutations that fail due to network go into the offline queue:

```ts
import { offlineQueue } from '@/lib/api/offline-queue'

try {
  await fetch('/api/v1/observations', { method: 'POST', body: JSON.stringify(obs) })
} catch (err) {
  if (!navigator.onLine) {
    await offlineQueue.enqueue({
      url: '/api/v1/observations',
      method: 'POST',
      body: obs,
      invalidateQueries: [['observations']],
    })
    // Tell user it's queued
  } else {
    throw err // real error, rethrow
  }
}
```

Queue auto-syncs on reconnect. Server reconciles by `X-Client-UUID` header.
