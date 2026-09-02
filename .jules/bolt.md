## 2024-09-02 - Performance Anti-Pattern: Avoid Math.max/min spread on large arrays
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays (like map stations or point clouds) causes V8 "Maximum call stack size exceeded" errors and excessive memory allocation.
**Action:** Always use a single `for` loop or `reduce` instead when calculating bounds on large datasets to process items iteratively.
