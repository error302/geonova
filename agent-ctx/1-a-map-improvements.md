# Task 1-a: Map Improvements for Metardu Survey Application

## Summary
Applied 8 improvements to MapClient.tsx and 1 to mapTypes.ts for the Metardu survey map application.

## Changes Made

### 1. Fix Terrain Basemap (BUG)
- **File**: `src/app/map/MapClient.tsx` (lines 268-275)
- Replaced CartoDB Light tiles (`{a-d}.basemaps.cartocdn.com/light_all/`) with OpenTopoMap (`{a-c}.tile.opentopomap.org/`)
- Changed maxZoom to 17, updated attributions to `© OpenTopoMap (CC-BY-SA)`

### 2. Add Bearing to Measure Tool
- **File**: `src/app/map/MapClient.tsx` (lines 857-889)
- Made `drawend` handler `async` to support `await import('ol/proj')`
- Added bearing computation: transforms first/last coords to EPSG:21037, computes `atan2(dE, dN)`, appends `" | Brg: X.XX°"` to distance result
- Bearing computation wrapped in try/catch to gracefully skip on failure

### 3. Add "Go to Project" Link in Cluster Click
- **File**: `src/app/map/mapTypes.ts` - Added `projectId?: string` to PopupData interface
- **File**: `src/app/map/MapClient.tsx`:
  - Feature creation (line ~378): Added `feature.set('projectId', project.id)`
  - Select handler (line ~548): Extract `projectId` from props or cluster features
  - PopupData construction: Pass `projectId` through
  - renderPopup function: Added "Go to Project →" link after the easting/northing section

### 4. Enhanced Feature Properties
- **File**: `src/app/map/MapClient.tsx` (lines 1549-1598)
- Replaced simple `Type: {type}` display with detailed geometry info:
  - Point: coordinates
  - LineString: vertex count + length
  - Polygon: vertex count + area + perimeter
  - Circle: radius + area
- Uses IIFE for inline computation within JSX

### 5. Map State Persistence (localStorage)
- **File**: `src/app/map/MapClient.tsx`
- Added `restoredState` state variable
- After map creation: restores saved view (center+zoom) and drawn features (GeoJSON) from localStorage
- New useEffect: saves map state every 10 seconds and on unmount
- Features saved as GeoJSON with EPSG:4326 data projection

### 6. URL Param ?projectId=xxx
- **File**: `src/app/map/MapClient.tsx`
- Added `useSearchParams` import and usage
- After zoom-to-data: checks for `projectId` URL param, finds matching feature, fits view to its extent

### 7. Offline Tiles Wiring
- **File**: `src/app/map/MapClient.tsx`
- Added `offlineDialogOpen` state
- Dynamic imports: `OfflineTileDownloader` and `OfflineTileManager` (ssr: false)
- Added "Offline Tiles" button in Actions section with Pro+ gate message
- Added `getMapExtent()` callback for computing current view extent in WGS84
- Rendered `OfflineTileDownloader` dialog before closing `MapErrorBoundary`

### 8. Project Search/Filter on Map
- **File**: `src/app/map/MapClient.tsx`
- Added `projectSearch` and `filteredProjectCount` state
- Added SearchIcon import from lucide-react
- Added "Projects" section in panel with search input and project count display

## Lint Status
- ✅ No ESLint warnings or errors
