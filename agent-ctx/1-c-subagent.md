# Task 1-c: Add DMS Format Support to coordSearch.ts

## Summary
Enhanced `/home/z/my-project/metardu-repo/src/app/map/utils/coordSearch.ts` to support DMS (Degrees, Minutes, Seconds) coordinate format in addition to the existing decimal lat/lon and UTM formats.

## Changes Made
- Added `DMSResult` interface for typed return values from DMS parsing
- Added `parseDMS()` function: regex-based parser for single DMS coordinate strings
  - Handles prefix/suffix hemisphere letters (N/S/E/W)
  - Supports degree (°), minute ('/′), second ("/″) symbols or space separators
  - Validates ranges: degrees 0-180, minutes 0-60, seconds 0-60
  - Converts to decimal: `degrees + minutes/60 + seconds/3600`, negated for S/W
- Added `tryParseDMS()` function: orchestrates parsing of full coordinate strings
  - Tries comma-separated DMS pairs first
  - Tries space-separated with iterative split-point detection
  - Tries compact two-group regex for formats like "S1°15'30\"E37°45'20\""
  - Applies Kenya defaults: lat → S (negative), lon → E (positive) when no hemisphere given
- Updated `handleCoordSearch()`: DMS parsing attempted first, falls back to existing decimal/UTM logic
- Updated JSDoc comments to document all three supported formats

## Supported DMS Formats
- `1°15'30"S 37°45'20"E` — with symbols and hemisphere suffixes
- `1 15 30 S 37 45 20 E` — space-separated with hemisphere letters
- `1°15'30" 37°45'20"` — no hemisphere (Kenya default: S lat, E lon)
- `S1°15'30" E37°45'20"` — prefix hemisphere
- Comma-separated variants of all above

## No Breaking Changes
All existing decimal lat/lon and UTM EPSG:21037 functionality is preserved as the fallback path.
