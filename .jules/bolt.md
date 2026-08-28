## 2026-08-07 - Pre-computation for constant lookups
**Learning:** Found an O(N) array search inside a frequently re-rendered `NavBar.tsx` (rendered on every page load). Even though it was wrapped in a `useMemo`, it still incurred an O(N) cost on every route change.
**Action:** Replaced static array lookup (`Array.find()`) with a pre-computed `Map` constructed outside the component for O(1) lookups. This pattern should be applied wherever static configuration arrays are repeatedly searched by a unique key during renders.
