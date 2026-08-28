## 2024-11-20 - Prevent max call stack exceeded in point cloud bounds calculation
**Learning:** Using `Math.min(...arr)` or `Math.max(...arr)` on large arrays (like point cloud data) causes V8's "Maximum call stack size exceeded" error. It also unnecessarily allocates large intermediate arrays if mapped first.
**Action:** Always use a `for` loop or `reduce` to find the minimum/maximum values over large arrays rather than the spread operator.
