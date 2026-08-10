## 2024-05-18 - Unnecessary component renders for nearest KenCORS Stations
**Learning:** `SurveyMap.tsx` calculates nearest KenCORS stations directly in an effect and maps them to standard React state. Since the computation only depends on `centroidEasting` and `centroidNorthing` which are top-level props, this could be easily memoized using `useMemo`. Right now, it fetches/updates these every time `centroidEasting` or `centroidNorthing` change via `initMap` which re-creates the entire map!
**Action:** Move this static logic out into a memoized function or `useMemo`.
## 2024-05-18 - editableVertices computation on every render
**Learning:** In `SurveyMap.tsx`, `editableVertices` is mapped from `adjustedStations` on every render.
**Action:** Memoize this with `useMemo`.
