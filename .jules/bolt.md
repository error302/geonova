## 2024-08-27 - Math.min/max spread anti-pattern on large arrays
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays (like point cloud data) causes V8 "Maximum call stack size exceeded" errors and excessive memory allocation.
**Action:** Always use `reduce()` or `for` loops instead of the spread operator when calculating min/max bounds for datasets that can grow large.
