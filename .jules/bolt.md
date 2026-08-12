## 2026-08-12 - CSS Transitions for UI Animations Instead of requestAnimationFrame
**Learning:** Using `requestAnimationFrame` inside React `useEffect` hooks to frequently update state for simple UI animations (like progress bars) triggers massive amounts of re-renders (60 FPS). In a component like `NotificationToast`, this blocks the main thread and impacts overall application performance.
**Action:** Always favor CSS `transition` or `animation` over React state updates for continuous visual changes where layout recalculation isn't strictly necessary.
