## 2024-05-24 - V8 Call Stack Limits with Spread Operator
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays (like point clouds) triggers V8 "Maximum call stack size exceeded" errors and causes excessive memory allocation.
**Action:** Avoid spreading large arrays into functions. Use `for` loops or `reduce` instead when calculating bounds on large datasets.
