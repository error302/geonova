## 2024-06-18 - V8 Call Stack Limits with Spread Operator on Large Data
**Learning:** Using `Math.min(...points.map(p => p.val))` on large arrays (like point clouds) triggers V8's "Maximum call stack size exceeded" error. It also unnecessarily allocates O(N) memory via `.map()` multiple times.
**Action:** Always use a single `for` loop or `reduce` instead of spread syntax with `Math.min`/`Math.max` when calculating bounds on large datasets in this codebase.
