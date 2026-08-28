## 2024-05-24 - V8 Call Stack Limits with Math.min/max on Large Point Clouds
**Learning:** Using the spread operator (`...`) with `Math.min()` or `Math.max()` on large arrays (like point cloud data) causes V8 'Maximum call stack size exceeded' errors and excessive memory allocation. It also iterates through the array multiple times if combined with `.map()`.
**Action:** Always use efficient `for`-loops or `.reduce()` to calculate bounding boxes and minimum/maximum values on large datasets instead of using the spread operator. Reuse bounding box logic wherever possible.
