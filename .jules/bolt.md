## 2024-05-18 - React.memo on Frequently Rendered List Rows
**Learning:** Wrapping individual list row components, like `ResultRow` in the `CommandPalette`, in `React.memo` is a simple but effective optimization to prevent unnecessary re-renders of all rows when only a single property (e.g., the selected state) changes during keyboard navigation.
**Action:** Always consider `React.memo` for list row components that might re-render frequently based on global list state changes (like arrow key navigation).
