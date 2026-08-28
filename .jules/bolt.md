## 2024-03-24 - Avoid Math.min(...array.map()) for large datasets
**Learning:** Using `Math.min(...array.map(...))` and `Math.max(...array.map(...))` on large datasets like point clouds creates intermediate arrays (memory overhead) and pushes all items onto the call stack via the spread operator. This causes a `Maximum call stack size exceeded` crash in V8 when processing arrays larger than ~120,000 elements.
**Action:** When calculating bounds on unbounded arrays or data structures like Point Clouds, always use a `for` loop or `reduce` instead of the spread operator.
