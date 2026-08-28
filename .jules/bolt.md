## 2024-08-28 - Spread Operator with Math.min/max on Large Arrays
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays (e.g., point cloud data in `pointCloudVolume.ts` or array lengths >= ~100k) causes V8 "Maximum call stack size exceeded" errors and excessive memory allocation.
**Action:** Use a `for` loop or `reduce` instead when calculating bounds on large datasets to avoid stack overflow errors and to significantly improve execution time.
