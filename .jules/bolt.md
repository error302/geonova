## 2024-05-24 - Avoid spread operator with Math.min/max on large datasets
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays (like point cloud data) causes V8 "Maximum call stack size exceeded" errors and excessive memory allocation.
**Action:** Use `for` loops or `reduce` instead when calculating bounds on large datasets.
