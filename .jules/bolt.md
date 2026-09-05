## 2025-02-05 - Avoid spread operator with Math.min/max on large arrays
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays (like point cloud data) causes V8 'Maximum call stack size exceeded' errors and excessive memory allocation.
**Action:** Use a simple `for` loop or `reduce` instead when calculating bounds on large datasets.
