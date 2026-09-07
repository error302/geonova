## 2024-05-18 - Math.min/max spread anti-pattern on large arrays
**Learning:** Using `Math.min(...points.map(p => p.easting))` on large point cloud arrays causes V8 "Maximum call stack size exceeded" errors (usually around 100k-120k points) and excessive memory allocation from the `.map()` array duplication.
**Action:** Always use explicit `for` loops (or `.reduce()`) to compute min/max bounds when dealing with potentially large datasets like point clouds or dense topographies.
