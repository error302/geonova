## 2024-05-30 - Replace spread syntax with reduce for calculating bounds on large arrays
**Learning:** Using `Math.min(...arr.map(...))` on large arrays like spot heights causes intermediate array allocations (O(N) memory) and triggers V8 "Maximum call stack size exceeded" errors.
**Action:** Always use `reduce` or a single `for` loop to compute bounds or other aggregations on large datasets, as it runs in O(N) time with O(1) memory and avoids call stack limits.
