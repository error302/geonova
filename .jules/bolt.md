## 2024-05-24 - Avoid Spread Operators with Math.min/max on Large Point Clouds
**Learning:** Using `Math.min(...array)` or `Math.max(...array)` with the spread operator on large arrays (like topographic point clouds or coordinate lists) causes V8 "Maximum call stack size exceeded" errors and excessive memory allocation in this codebase.
**Action:** Use standard `for` loops or `reduce` instead when calculating bounds on large datasets to avoid call stack limits and improve execution speed/memory overhead.
