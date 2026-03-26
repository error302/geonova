# METARDU Computation Integrity Rules

> **These rules are absolute. They apply to every computation, formula, and algorithm in the entire codebase. Violating them endangers users' professional licenses and METARDU's credibility.**

---

## The Golden Rule

**Every formula must cite its source in a code comment before it is written.** If you cannot cite a source, do not write the formula. Stop and ask.

---

## Rule 1 — Every Formula Must Be Traceable to a Named Source

```typescript
// Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Section 10.3
// Source: N.N. Basak, Surveying and Levelling, Chapter 3
// Source: RDM 1.1 Kenya 2025, Table 2.4
// Source: Survey Regulations 1994, Cap 299, Regulation 97
```

**If you cannot cite a source: STOP. Do not write the formula. State the specific missing reference.**

---

## Rule 2 — Approved Textbook Sources

| Topic | Primary Source | Secondary |
|-------|---------------|----------|
| Traverse adjustment | Basak Ch. 10-11 | Ghilani & Wolf Ch. 12 |
| Leveling (Rise & Fall, HOC) | Basak Ch. 5-7 | Ghilani & Wolf Ch. 5-6 |
| COGO (Inverse, Polar, Intersection, Resection) | Ghilani & Wolf Ch. 10 | Basak Ch. 3 |
| Area (Shoelace) | Ghilani & Wolf Ch. 12.5 | Basak Ch. 4 |
| Horizontal curves | RDM 1.3 Kenya §5.2 | Ghilani & Wolf Ch. 24 |
| Vertical curves | RDM 1.3 Kenya §5.4 | Ghilani & Wolf Ch. 25 |
| Superelevation | RDM 1.3 Kenya §5.3 | Merritt Handbook |
| Sight distance | RDM 1.3 Kenya §3.3 | Ghilani & Wolf |
| EDM corrections | USACE EM 1110-1-1005 §3-5 | NOAA NOS NGS 5 |
| Accuracy classification | RDM 1.1 Kenya Table 2.4 | Ghilani & Wolf Ch. 12 |
| Leveling misclosure | RDM 1.1 Kenya Table 5.1 | USACE EM 1110-1-1005 |

---

## Rule 3 — Kenya Standard Takes Priority for Kenya Surveys

- **Traverse accuracy**: RDM 1.1 Table 2.4 — `C = m√K` with m = 0.5/0.7/1.0/1.3/2.0 mm/√km
- **Leveling misclosure**: RDM 1.1 Table 5.1 — **10√K mm** for direct differential leveling (NOT 12√K — that is USACE)
- **Horizontal curves**: RDM 1.3 Table 3-3 minimum radii, Table 3-4 friction factors
- **Sight distance**: RDM 1.3 Table 3-5 (SSD), Table 3-6 (PSD)
- **Superelevation**: RDM 1.3 §5.3 — maximum 8%, rate of change 1% per 2.4m

---

## Rule 4 — Field Book Sequence Must Match Surveyor Training

| Computation | Required Column Order |
|-------------|---------------------|
| Level book | Station \| BS \| IS \| FS \| Rise \| Fall \| RL \| Distance \| Remarks |
| Traverse Gale's Table | Line \| Distance \| Bearing \| Northing \| Easting |
| Coordinate table | Point \| Easting \| Northing \| RL |
| Bearing format | `DDD°MM'SS.S"` (3-digit degrees, 2-digit minutes, 2-digit seconds) |
| Chainage format | `km+m` e.g. `2+450.000` |

---

## Rule 5 — Arithmetic Check Is Mandatory

Every computation with a known mathematical check must display that check with a **pass/fail indicator computed independently**:

| Computation | Check |
|-------------|-------|
| Level book | ΣBS − ΣFS = Last RL − First RL (Basak) |
| Traverse | ΣDepartures and ΣLatitudes independently computed |
| Area (Shoelace) | Computed twice: Σ(En×Nn+1) and Σ(Nn×En+1) separately |
| Vertical curve | RL at EVC via formula = EVC RL via grades |
| Curve CT chainage | CT via IP+T = CT via TC+L |

If the check **fails**: display RED indicator with message "Arithmetic check failed — do not use these results."

---

## Rule 6 — No Approximations Without Warning

```typescript
// ⚠️ NOTE: Volume computed using End Area Method. Source: Basak Ch. 8.
// May overestimate by up to 3% vs Prismoidal Formula. Source: Ghilani & Wolf, Ch. 26.
```

---

## Rule 7 — Full Working, Not Just Answers

Every computation screen must show step-by-step working with formula, substitution, and result — not just the final answer.

---

## Files Under These Rules

These rules apply to every formula in:
- `src/lib/engine/**/*.ts`
- `src/lib/computations/**/*.ts`
- `src/lib/reports/**/*.ts`
- `src/lib/validation/**/*.ts`
- `src/lib/python/**/*.py`
- Any future computation module

**Rules do NOT apply to**: UI layout, database queries, file parsing, PDF formatting, authentication, routing.

---

## Source Citation Format

Every formula in every computation file should use inline citations:

```typescript
// Source: [Author], [Book Title], [Chapter/Edition]
// Formula description
const result = formula
```

Examples:
```typescript
// Source: Basak, Chapter 10, Eq. 10.2 — Mean angle = (HCL + HCR_adj) / 2
const meanAngle = (hcl + hcrAdj) / 2

// Source: Ghilani & Wolf, Section 12.5 — Shoelace: 2A = Σ(En×Nn+1) − Σ(Nn×En+1)
const doubleArea = posSum - negSum

// Source: RDM 1.1 Table 2.4 — Accuracy: C = m√K (m = 2.0mm/√km for Third Order)
const allowable = 2.0 * Math.sqrt(K_km) / 1000
```
