# METARDU Fraud Prevention

This document covers all anti-fraud measures in the METARDU platform. Each section describes a specific fraud vector and the controls in place to prevent it.

## CPD (Continuing Professional Development) Fraud

CPD points are statutory — surveyors need them for ISK license renewal. Fraudulent CPD points could lead to unqualified surveyors operating legally.

### Fraud vectors and controls

| Vector | Risk | Control |
|--------|------|---------|
| **Double-awarding** — same activity awards points twice (retry click, race condition) | Medium | Unique index on `(user_id, reference_id)` in `cpd_records` + pre-insert duplicate check in `awardCPDPoints()` |
| **Self-awarding** — user claims points for peer review they didn't do | High | `awardCPDPoints()` is only called by server-side code (peer review completion handler, job completion handler). Users cannot call it directly via the API. |
| **Fake manual entries** — user claims 50 points for a conference they didn't attend | High | Manual entries (`TRAINING_COMPLETED`, `CONFERENCE_ATTENDED`, `MANUAL_ENTRY`) are created with `approved=FALSE`. They don't count toward the total until an admin approves them via `/api/cpd/approve`. |
| **Point inflation** — user submits many small entries to bypass per-entry caps | Medium | Annual cap of 100 points (`CPD_ANNUAL_CAP`). `awardCPDPoints()` checks the current total before awarding. |
| **Certificate forgery** — user fabricates a CPD certificate with fake verification code | High | Verification codes use `crypto.randomBytes()` (not `Math.random()`) — 36^12 = 4.7 quintillion possibilities. Codes are unique-indexed in the DB. |
| **Certificate tampering** — user modifies their total_points after certificate generation | Medium | `total_points` is stored in `cpd_certificates` at generation time and is immutable. The verification endpoint reads from the certificate, not from live `cpd_records`. |
| **Reading others' CPD records** — privacy violation | Medium | `/api/cpd` GET requires auth. Non-admins can only view their own records. Admins can view any user. |
| **Admin self-approval** — admin approves their own manual entries | Low | No technical prevention (relies on policy). Audit chain logs who approved what, so misuse is detectable. |

### Database-level controls (migration 039)

```sql
-- Unique constraint prevents duplicate awards
CREATE UNIQUE INDEX idx_cpd_records_unique_reference
  ON cpd_records (user_id, reference_id)
  WHERE reference_id IS NOT NULL;

-- approved column: FALSE for manual entries, TRUE for system-generated
ALTER TABLE cpd_records ADD COLUMN approved BOOLEAN NOT NULL DEFAULT TRUE;

-- awarded_by: who submitted the entry (NULL for system, user_id for manual)
ALTER TABLE cpd_records ADD COLUMN awarded_by UUID REFERENCES users(id);

-- approved_by: which admin approved/rejected the manual entry
ALTER TABLE cpd_records ADD COLUMN approved_by UUID REFERENCES users(id);

-- rejection_reason: why the entry was rejected (audit trail)
ALTER TABLE cpd_records ADD COLUMN rejection_reason TEXT;
```

### Audit chain (tamper-evident logging)

Every CPD award and approval/rejection is logged to the `audit_chain` table via PostgreSQL triggers. The chain is tamper-evident — each entry's `hash_current` is `SHA256(hash_prev + payload + timestamp)`, so modifying any past entry breaks the chain.

```
award → audit_chain entry (action: 'cpd_award', payload: {activity, points, ...})
approve → audit_chain entry (action: 'cpd_approved', payload: {approved_by, ...})
reject → audit_chain entry (action: 'cpd_rejected', payload: {rejection_reason, ...})
```

### API endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/cpd` | Required | View own CPD records (admin can view any user) |
| `GET /api/cpd?action=summary` | Required | Get total/pending/cap summary (for widgets) |
| `GET /api/cpd?action=verify&code=XXX` | Public | Verify a CPD certificate by code |
| `GET /api/cpd?action=pending` | Admin | List pending manual entries for review |
| `POST /api/cpd` | Required | Submit a manual CPD entry (pending approval) |
| `POST /api/cpd/approve` | Admin | Approve or reject a manual entry |

## Identity Fraud

### ISK (Institution of Surveyors of Kenya) verification

| Vector | Risk | Control |
|--------|------|---------|
| **Fake ISK number** — user enters a random ISK number at registration | High | `verified_isk` flag defaults to `FALSE`. Admins verify against the ISK registry before setting it to `TRUE`. Unverified users can't appear in the public surveyor directory. |
| **Stealing someone's ISK number** — user enters another surveyor's ISK number | High | Admin verification against the ISK registry (name + ISK number must match). The `/api/admin/users/[userId]/verify-isk` endpoint handles this. |

### Authentication

| Vector | Risk | Control |
|--------|------|---------|
| **Brute-force login** | Medium | Rate limit: 5 failed login attempts per 15 minutes per IP+email (`loginLimiter.ts`). Account lockout after threshold. |
| **Password guessing** | Medium | bcrypt password hashing (3 rounds = ~100ms per hash, slow for attackers). Minimum 8 character password. |
| **Session hijacking** | Medium | NextAuth JWT with `AUTH_SECRET` (crypto-random 32 bytes). HTTP-only cookies. CSRF origin check in middleware. |
| **Account sharing** | Low | No technical prevention (policy matter). Audit chain logs which user performed each action. |

## Financial Fraud

### Payment fraud

| Vector | Risk | Control |
|--------|------|---------|
| **Fake payment confirmation** — user claims they paid but didn't | High | M-Pesa callback uses Safaricom IP whitelist (only Safaricom's servers can call `/api/payments/mpesa/callback`). Stripe/PayPal use webhook signature verification. |
| **Duplicate payment** — user pays twice for same subscription | Low | Payment providers handle this natively (idempotency keys). Our webhook handler checks for duplicate transaction IDs. |
| **Refund fraud** — user requests refund after using the service | Low | Handled case-by-case by admin. Refunds are logged to the audit chain. |

### Subscription fraud

| Vector | Risk | Control |
|--------|------|---------|
| **Plan bypass** — user accesses Pro features on a Free plan | Medium | Middleware checks subscription status on protected routes. `apiHandler` enforces plan limits via `requirePlan()` decorator. |
| **Trial abuse** — user creates multiple accounts for free trials | Medium | Email-based deduplication (one trial per email). IP-based rate limit on registration (5 per 15 minutes per IP). |

## Data Fraud

### Boundary/coordinate fraud

| Vector | Risk | Control |
|--------|------|---------|
| **Altering survey coordinates** — user modifies coordinates after surveyor sign-off | High | Cryptographic seal on projects (migration 037). Any modification breaks the seal and is flagged. |
| **Fake deed plan** — user generates a deed plan without a valid survey | Medium | Deed plan generation requires a project with valid traverse data (closure check). The `StatutoryGatePanel` enforces Survey Act Cap. 299 compliance. |

### Audit trail fraud

| Vector | Risk | Control |
|--------|------|---------|
| **Deleting audit logs** — admin deletes incriminating audit entries | High | Audit chain is tamper-evident (SHA256 hash chain). Deleting any entry breaks the chain. The chain is append-only — no DELETE or UPDATE permissions on `audit_chain` for any role. |
| **Modifying audit logs** — admin modifies an audit entry to cover tracks | High | Same as above — modifying any entry breaks the hash chain. The `hash_prev` field links each entry to the previous one. |

## Reporting and Monitoring

### Suspicious activity detection

The following patterns are flagged for admin review:

1. **Rapid CPD accumulation** — more than 20 points in a single day
2. **Multiple failed login attempts** — 5+ in 15 minutes
3. **Registration from same IP** — 5+ accounts from one IP in 24 hours
4. **API abuse** — hitting rate limits repeatedly
5. **Unusual export volume** — 50+ exports in an hour

### Incident response

If fraud is detected:

1. **Suspend the account** — `POST /api/admin/users/[userId]/suspend`
2. **Audit the damage** — query `audit_chain` for all actions by the user
3. **Revoke fraudulent records** — set `approved=FALSE` on fraudulent CPD entries
4. **Notify affected parties** — if the fraud affects other users (e.g., fake peer review)
5. **Document the incident** — add a note to the user's audit trail

## Future improvements

- [ ] Two-factor authentication (2FA) for admin accounts
- [ ] ISK registry API integration (auto-verify ISK numbers)
- [ ] Anomaly detection ML model for unusual CPD patterns
- [ ] Blockchain-based audit chain (instead of hash chain in PostgreSQL)
- [ ] Mandatory document upload for manual CPD entries (training certificates, conference badges)
