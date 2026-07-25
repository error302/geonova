# Admin Dashboard Access Guide

## Where is the Admin Dashboard?

**URL:** `/admin`

The admin dashboard is a full-featured admin panel with:
- User statistics (total, new this month, active)
- Project statistics (by status)
- Revenue charts (monthly trend line + subscription donut)
- System health panel (DB latency, uptime, memory, response time)
- ISK verification queue (approve/reject surveyor licenses)
- Announcement broadcast form
- Subscription plan override form
- Recent signups table with role badges
- User management (`/admin/users`)
- Payment management (`/admin/payments`)

## How to Access It

### Option 1: Set your email in `.env`

Edit `.env` (or `.env.local`):

```env
# Admin emails (comma-separated) — these users get admin role
ADMIN_EMAILS=your.email@example.com,partner@example.com

# Platform owner (gets super_admin — full control)
PLATFORM_OWNER_EMAIL=your.email@example.com
```

Then restart the app: `npm run dev`

Log in with that email — you'll see "Admin Panel" in the sidebar (desktop) or in the "More" drawer (mobile).

### Option 2: Direct database role grant

If you have database access:

```sql
-- Grant admin role to a user
UPDATE surveyor_profiles
SET role = 'admin'
WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com');

-- Or super_admin (highest level)
UPDATE surveyor_profiles
SET role = 'super_admin'
WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com');
```

The user must log out and log back in for the role to take effect.

## Three-Layer Access Control

The admin dashboard is protected by three independent layers:

### Layer 1: Edge Middleware (`middleware.ts`)

Every request to `/admin/*` is checked at the edge:

```ts
if (isAdminRoute && isAuthenticated) {
  const userRole = token?.role
  const adminRoles = ['super_admin', 'admin', 'org_admin']
  if (!userRole || !adminRoles.includes(userRole)) {
    return NextResponse.redirect('/dashboard')  // bounce non-admins
  }
}
```

Unauthenticated users are redirected to `/login?next=/admin`.

### Layer 2: Server-side helper (`src/lib/auth/session.ts`)

API routes under `/api/admin/*` use the `isAdmin()` helper:

```ts
export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return false

  const userRole = session.user.role
  if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'org_admin') {
    return true
  }

  // Fallback: check ADMIN_EMAILS env var
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
  return adminEmails.includes(session.user.email?.toLowerCase())
}
```

### Layer 3: Client-side check (`src/app/admin/page.tsx`)

The admin page itself checks the session on load:

```tsx
const { data: session, status } = useSession()
useEffect(() => {
  if (status === 'unauthenticated') router.push('/login')
  if (status === 'authenticated') {
    fetch('/api/admin/dashboard')
      .then(res => {
        if (res.status === 401) router.push('/login')
        if (res.status === 403) router.push('/dashboard')  // not admin
      })
  }
}, [status])
```

## Role Hierarchy

| Role | Permissions |
|------|-------------|
| `super_admin` | Everything. Can manage other admins, override payments, broadcast announcements. |
| `admin` | Full admin dashboard access except managing other admins. |
| `org_admin` | Admin dashboard access scoped to their organization. |
| `project_manager` | No admin access. Can manage projects. |
| `surveyor` | No admin access. Standard surveyor user. |
| `viewer` | No admin access. Read-only. |

## How the Role is Determined at Login

The login flow (`src/lib/auth.ts`, `signIn` callback) determines role in this priority:

1. **`PLATFORM_OWNER_EMAIL` env var** → `super_admin` (always, regardless of DB state)
2. **`ADMIN_EMAILS` env var** → `super_admin`
3. **`users.role` column** → whatever is stored
4. **`surveyor_profiles.role` column** → fallback
5. **Default** → `surveyor`

## Navigation Links

### Desktop (sidebar)

`src/components/layout/AppSidebar.tsx:148-157` conditionally renders an "Admin Panel" link in the sidebar footer for admin users:

```tsx
{(userRole === 'super_admin' || userRole === 'admin' || userRole === 'org_admin') && (
  <Link href="/admin" className="text-[var(--accent)]">
    <ShieldCheck className="w-4 h-4" /> Admin Panel
  </Link>
)}
```

### Top NavBar (user dropdown)

`src/components/NavBar.tsx:595-616` also exposes "Admin Dashboard" and "User Management" in the user dropdown for admin users.

### Mobile (bottom nav "More" drawer)

`src/components/MobileNav.tsx` conditionally renders an "Admin Dashboard" link in the "More" drawer for admin users (admin users on mobile: tap "More" → "Administration" section → "Admin Dashboard").

## Quick Start (for the platform owner)

1. Add your email to `.env`:
   ```env
   PLATFORM_OWNER_EMAIL=your.email@example.com
   ADMIN_EMAILS=your.email@example.com
   ```

2. Restart: `npm run dev`

3. Log in at `http://localhost:3000/login`

4. Visit `http://localhost:3000/admin`

You should see the full admin dashboard with stats, charts, and management tools.
