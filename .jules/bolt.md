## 2024-06-25 - Avoid Spread Operator with Math.min/max on Point Clouds
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays, especially point cloud data mapped from an array of objects, causes V8 "Maximum call stack size exceeded" errors and excessive memory allocation.
**Action:** Always use explicit `for` loops or `reduce` instead of `Math.max(...arr)` or `Math.min(...arr)` when calculating bounds on large datasets (e.g. `gridMethodVolume`, `getBounds`, `contour-generator`).
