// ─── SURVEY ENGINE — PUBLIC API ───────────────────────────────────────────────
// Import everything you need from here. Do not import from individual modules
// directly — this file is the stable public interface.

// Types
export type {
  Point2D,
  Point3D,
  NamedPoint2D,
  NamedPoint3D,
  DMS,
  LatLon,
  UTMCoord,
  SurveyResult,
} from "./types";

// Angle utilities
export {
  toRadians,
  toDegrees,
  normalizeBearing,
  decimalToDMS,
  dmsToDecimal,
  bearingToString,
  parseDMSString,
} from "./angles";

// Distance & bearing
export type { DistanceBearingResult, SlopeResult, SlopeCorrectionResult, TapeCorrectionResult } from "./distance";
export {
  distanceBearing,
  slopeDistance,
  polarPoint,
  horizontalFromSlope,
  tapeTemperatureCorrection,
  edmAtmosphericCorrection,
  sagCorrection,
} from "./distance";

// Traverse adjustment
export type {
  TraverseLeg,
  TraverseResult,
  TraverseOrder,
  TraverseOrderSpec,
  TraverseValidation,
  TraverseEnvironment,
  TraverseClosureResult,
} from "./traverse";
export {
  TRAVERSE_ORDERS,
  validateTraversePrecision,
  computeTraverseClosure,
  bowditchAdjustment,
  transitAdjustment,
} from "./traverse";

// Leveling
export type {
  StationType,
  LevelingReading,
  LevelingRow,
  LevelingResult,
} from "./leveling";
export { riseAndFall, heightOfCollimation } from "./leveling";

// Area
export type {
  AreaResult,
  SubdivisionResult,
  AreaPrecisionResult,
  AreaPrecision,
} from "./area";
export {
  coordinateArea,
  subdividePolygon,
  formatAreaForDisplay,
  minimumParcelAreaWarning,
} from "./area";

// Coordinate conversion
export { geographicToUTM, utmToGeographic, latLonToString } from "./coordinates";

// COGO
export type { IntersectionResult, ResectionResult } from "./cogo";
export {
  radiation,
  bearingIntersection,
  tienstraResection,
  distanceIntersection,
} from "./cogo";
