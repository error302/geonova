"""
METARDU OSM Feature Server — Pyrosm-based local PBF parsing

PROBLEM
-------
The map page currently shows only satellite imagery. Surveyors need to see
building footprints, road names, and POIs for context — "is this beacon
3m from the road edge?", "is there a building encroaching?".

Querying Overpass API on every pan/zoom is slow (rate limits, network
latency). Instead, download Kenya's PBF extract once from Geofabrik and
serve features locally at SQL-speed.

WHAT THIS MODULE DOES
---------------------
1. Loads a .osm.pbf file once at startup (Kenya extract, ~450MB)
2. Serves building footprints, road lines, and POIs by bounding box
3. Returns GeoJSON FeatureCollections ready for OpenLayers

LIBRARY: Pyrosm (https://pyrosm.readthedocs.io/)
- C++ backend (protozero) — fast PBF parsing
- Reads local files — no network dependency, no rate limits
- Outputs GeoDataFrames — easy conversion to GeoJSON

SETUP
-----
1. Download Kenya PBF:
   wget https://download.geofabrik.de/africa/kenya-latest.osm.pbf
2. Place at: data/kenya-latest.osm.pbf (or set OSM_PBF_PATH env var)
3. Restart the Python worker

USAGE
-----
GET /osm/features?minlon=36.8&minlat=-1.3&maxlon=36.85&maxlat=-1.25&types=buildings,roads,pois

Returns:
{
  "buildings": { "type": "FeatureCollection", "features": [...] },
  "roads": { "type": "FeatureCollection", "features": [...] },
  "pois": { "type": "FeatureCollection", "features": [...] }
}
"""

import os
import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

# ─── PBF Path Resolution ────────────────────────────────────────────────────

DEFAULT_PBF_PATHS = [
    os.environ.get("OSM_PBF_PATH", ""),
    "data/kenya-latest.osm.pbf",
    "/data/kenya-latest.osm.pbf",
    "../data/kenya-latest.osm.pbf",
]

def find_pbf_file() -> Optional[str]:
    """Find the Kenya PBF file in standard locations."""
    for path in DEFAULT_PBF_PATHS:
        if path and os.path.exists(path):
            return path
    return None

# ─── Lazy Pyrosm Import (graceful if not installed) ─────────────────────────

_pyrosm = None
_pbf_reader = None
_pbf_path = None

def get_pyrosm():
    """Lazy-import Pyrosm. Returns None if not installed."""
    global _pyrosm
    if _pyrosm is None:
        try:
            import pyrosm
            _pyrosm = pyrosm
            logger.info("[osm] Pyrosm loaded successfully")
        except ImportError:
            logger.warning("[osm] Pyrosm not installed. OSM features disabled.")
            _pyrosm = False  # cache the failure
    return _pyrosm if _pyrosm is not False else None

def get_pbf_reader():
    """Get or initialize the Pyrosm PBF reader (loaded once)."""
    global _pbf_reader, _pbf_path
    if _pbf_reader is not None:
        return _pbf_reader

    pyrosm = get_pyrosm()
    if not pyrosm:
        return None

    pbf_path = find_pbf_file()
    if not pbf_path:
        logger.warning(
            "[osm] No PBF file found. Download Kenya extract from "
            "https://download.geofabrik.de/africa/kenya-latest.osm.pbf "
            "and place at data/kenya-latest.osm.pbf"
        )
        return None

    try:
        _pbf_reader = pyrosm.OSM(pbf_path)
        _pbf_path = pbf_path
        logger.info(f"[osm] Loaded PBF: {pbf_path} ({os.path.getsize(pbf_path) / 1e6:.1f} MB)")
        return _pbf_reader
    except Exception as e:
        logger.error(f"[osm] Failed to load PBF: {e}")
        return None

# ─── Bounding Box Filtering ─────────────────────────────────────────────────

def filter_by_bbox(gdf, minlon, minlat, maxlon, maxlat):
    """Filter a GeoDataFrame to a bounding box using Shapely."""
    if gdf is None or len(gdf) == 0:
        return gdf
    try:
        from shapely.geometry import box
        bbox = box(minlon, minlat, maxlon, maxlat)
        return gdf[gdf.geometry.intersects(bbox)]
    except Exception as e:
        logger.warning(f"[osm] BBox filter failed: {e}")
        return gdf

def gdf_to_geojson(gdf):
    """Convert GeoDataFrame to GeoJSON FeatureCollection (serializable)."""
    if gdf is None or len(gdf) == 0:
        return {"type": "FeatureCollection", "features": []}
    try:
        # Reproject to WGS84 if needed
        if gdf.crs and str(gdf.crs) != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
        # Drop non-serializable columns
        for col in gdf.columns:
            if col != "geometry" and gdf[col].dtype == "object":
                # Convert lists/dicts to strings
                gdf[col] = gdf[col].astype(str)
        features = json.loads(gdf.to_json())
        return features
    except Exception as e:
        logger.error(f"[osm] GeoJSON conversion failed: {e}")
        return {"type": "FeatureCollection", "features": []}

# ─── Feature Extractors ─────────────────────────────────────────────────────

def get_buildings(minlon, minlat, maxlon, maxlat):
    """Extract building footprints within the bounding box."""
    reader = get_pbf_reader()
    if not reader:
        return {"type": "FeatureCollection", "features": []}
    try:
        buildings = reader.get_buildings()
        filtered = filter_by_bbox(buildings, minlon, minlat, maxlon, maxlat)
        return gdf_to_geojson(filtered)
    except Exception as e:
        logger.error(f"[osm] Buildings extraction failed: {e}")
        return {"type": "FeatureCollection", "features": []}

def get_roads(minlon, minlat, maxlon, maxlat):
    """Extract road lines within the bounding box."""
    reader = get_pbf_reader()
    if not reader:
        return {"type": "FeatureCollection", "features": []}
    try:
        # get_network() returns roads; filter to highway tags
        roads = reader.get_network(network_type="driving")
        if roads is not None and len(roads) > 0:
            # Keep only meaningful road types
            if "highway" in roads.columns:
                road_types = ["motorway", "trunk", "primary", "secondary",
                              "tertiary", "residential", "unclassified",
                              "motorway_link", "trunk_link", "primary_link",
                              "secondary_link", "tertiary_link"]
                roads = roads[roads["highway"].isin(road_types)]
        filtered = filter_by_bbox(roads, minlon, minlat, maxlon, maxlat)
        return gdf_to_geojson(filtered)
    except Exception as e:
        logger.error(f"[osm] Roads extraction failed: {e}")
        return {"type": "FeatureCollection", "features": []}

def get_pois(minlon, minlat, maxlon, maxlat):
    """Extract points of interest (schools, hospitals, etc.) within bbox."""
    reader = get_pbf_reader()
    if not reader:
        return {"type": "FeatureCollection", "features": []}
    try:
        pois = reader.get_pois()
        filtered = filter_by_bbox(pois, minlon, minlat, maxlon, maxlat)
        return gdf_to_geojson(filtered)
    except Exception as e:
        logger.error(f"[osm] POIs extraction failed: {e}")
        return {"type": "FeatureCollection", "features": []}

def get_natural(minlon, minlat, maxlon, maxlat):
    """Extract natural features (water bodies, parks, forests)."""
    reader = get_pbf_reader()
    if not reader:
        return {"type": "FeatureCollection", "features": []}
    try:
        # get_natural() returns water, forests, parks
        natural = reader.get_natural()
        filtered = filter_by_bbox(natural, minlon, minlat, maxlon, maxlat)
        return gdf_to_geojson(filtered)
    except Exception as e:
        logger.error(f"[osm] Natural features extraction failed: {e}")
        return {"type": "FeatureCollection", "features": []}

# ─── API Router ─────────────────────────────────────────────────────────────

router = APIRouter(prefix="/osm", tags=["osm"])

@router.get("/features")
async def get_features(
    minlon: float = Query(..., description="Minimum longitude (WGS84)"),
    minlat: float = Query(..., description="Minimum latitude (WGS84)"),
    maxlon: float = Query(..., description="Maximum longitude (WGS84)"),
    maxlat: float = Query(..., description="Maximum latitude (WGS84)"),
    types: str = Query("buildings,roads,pois", description="Comma-separated: buildings,roads,pois,natural"),
):
    """
    Get OSM features within a bounding box from the local PBF extract.

    Returns GeoJSON FeatureCollections for each requested type.
    """
    requested = [t.strip() for t in types.split(",") if t.strip()]
    result = {}

    for feature_type in requested:
        if feature_type == "buildings":
            result["buildings"] = get_buildings(minlon, minlat, maxlon, maxlat)
        elif feature_type == "roads":
            result["roads"] = get_roads(minlon, minlat, maxlon, maxlat)
        elif feature_type == "pois":
            result["pois"] = get_pois(minlon, minlat, maxlon, maxlat)
        elif feature_type == "natural":
            result["natural"] = get_natural(minlon, minlat, maxlon, maxlat)

    return {
        "success": True,
        "bbox": {"minlon": minlon, "minlat": minlat, "maxlon": maxlon, "maxlat": maxlat},
        "counts": {k: len(v.get("features", [])) for k, v in result.items()},
        "features": result,
        "pbf_loaded": _pbf_path is not None,
    }

@router.get("/status")
async def get_status():
    """Check if the OSM PBF is loaded and ready."""
    pbf_path = find_pbf_file()
    pyrosm_available = get_pyrosm() is not None
    return {
        "pyrosm_installed": pyrosm_available,
        "pbf_file_found": pbf_path is not None,
        "pbf_path": pbf_path,
        "pbf_loaded": _pbf_path is not None,
        "pbf_size_mb": (os.path.getsize(pbf_path) / 1e6) if pbf_path else None,
        "setup_instructions": (
            "Download Kenya PBF from https://download.geofabrik.de/africa/kenya-latest.osm.pbf "
            "and place at data/kenya-latest.osm.pbf"
        ) if not pbf_path else None,
    }
