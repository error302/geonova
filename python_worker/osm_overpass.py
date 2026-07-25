"""
METARDU OSM Overpass Client — OSMPythonTools-based

PROBLEM
-------
For deed plans and survey reports, surveyors need to reference nearby features:
"The parcel is bounded on the north by the Mombasa Road (A8), 200m east of
Kitengela Primary School."

Currently surveyors type these manually. This module auto-queries OSM for
named features near a point and returns them in a structured format that
can auto-populate deed plan abuttals and survey descriptions.

LIBRARY: OSMPythonTools (https://github.com/mocnik-science/osm-python-tools)
- Wraps Overpass API, Nominatim, and the OSM API
- More flexible than OSMnx for non-road queries
- Returns structured Python objects with metadata

WHAT THIS MODULE DOES
---------------------
1. Given a lat/lon and radius, finds nearby named features:
   - Roads (with names like "Mombasa Road", "Thika Superhighway")
   - Schools, hospitals, clinics, churches, mosques
   - Rivers, streams, water bodies
   - Administrative boundaries (ward, constituency, county)
2. Categorizes them by direction (N/S/E/W) for deed plan abuttals
3. Returns a structured "context" object for auto-populating documents

LIBRARY: osm2geojson (https://github.com/aspectum/osm2geojson)
- Glue library that converts raw Overpass JSON (nodes/ways/relations)
  into proper GeoJSON with assembled geometries
- Handles multipolygon relation assembly

USAGE
-----
POST /osm/nearby-features
{
  "lat": -1.2921,
  "lon": 36.8219,
  "radius": 500,
  "feature_types": ["roads", "schools", "health", "water", "boundaries"]
}

Returns:
{
  "roads": [{ "name": "Mombasa Road", "type": "trunk", "distance_m": 120, "direction": "E" }],
  "schools": [{ "name": "Kitengela Primary", "distance_m": 280, "direction": "NE" }],
  ...
}
"""

import os
import math
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ─── Lazy Imports ───────────────────────────────────────────────────────────

_osm_tools = None
_osm2geojson = None

def get_osm_tools():
    """Lazy-import OSMPythonTools."""
    global _osm_tools
    if _osm_tools is None:
        try:
            from OSMPythonTools.nominatim import Nominatim
            from OSMPythonTools.overpass import overpassQueryBuilder, Overpass
            _osm_tools = {
                "Nominatim": Nominatim,
                "overpassQueryBuilder": overpassQueryBuilder,
                "Overpass": Overpass,
            }
            logger.info("[osm-overpass] OSMPythonTools loaded")
        except ImportError:
            logger.warning("[osm-overpass] OSMPythonTools not installed.")
            _osm_tools = False
    return _osm_tools if _osm_tools is not False else None

def get_osm2geojson():
    """Lazy-import osm2geojson."""
    global _osm2geojson
    if _osm2geojson is None:
        try:
            import osm2geojson
            _osm2geojson = osm2geojson
            logger.info("[osm-overpass] osm2geojson loaded")
        except ImportError:
            logger.warning("[osm-overpass] osm2geojson not installed.")
            _osm2geojson = False
    return _osm2geojson if _osm2geojson is not False else None

# ─── Geometry Helpers ───────────────────────────────────────────────────────

def haversine_distance(lat1, lon1, lat2, lon2):
    """Distance between two points in meters (haversine)."""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def bearing_to_direction(lat1, lon1, lat2, lon2):
    """Compute compass direction (N/NE/E/SE/S/SW/W/NW) from point 1 to point 2."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    theta = math.atan2(x, y)
    bearing = (math.degrees(theta) + 360) % 360

    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = round(bearing / 45) % 8
    return directions[idx]

def get_centroid(geometry):
    """Get centroid [lon, lat] from a GeoJSON geometry."""
    geom_type = geometry.get("type")
    coords = geometry.get("coordinates")

    if geom_type == "Point":
        return coords
    if geom_type == "LineString":
        # Use midpoint
        mid = coords[len(coords) // 2]
        return mid
    if geom_type == "Polygon":
        # Average of outer ring
        ring = coords[0]
        lon = sum(p[0] for p in ring) / len(ring)
        lat = sum(p[1] for p in ring) / len(ring)
        return [lon, lat]
    if geom_type == "MultiPolygon":
        # Use first polygon
        return get_centroid({"type": "Polygon", "coordinates": coords[0]})
    return coords[0] if coords else [0, 0]

# ─── Overpass Query Builders ────────────────────────────────────────────────

def query_roads(lat, lon, radius):
    """Query Overpass for named roads near a point."""
    tools = get_osm_tools()
    if not tools:
        return []
    try:
        query = tools["overpassQueryBuilder"](
            area=None,
            bbox=[lat - 0.005, lon - 0.005, lat + 0.005, lon + 0.005],
            selector='"highway"',
            includeGeometry=True,
        )
        result = tools["Overpass"]().query(query)
        features = []
        for element in result.elements():
            tags = element.tags() or {}
            name = tags.get("name")
            if not name:
                continue
            highway_type = tags.get("highway", "road")
            # Get centroid
            if element.geometry():
                coords = [(g["lat"], g["lon"]) for g in element.geometry()]
                if coords:
                    mid_lat = sum(c[0] for c in coords) / len(coords)
                    mid_lon = sum(c[1] for c in coords) / len(coords)
                    dist = haversine_distance(lat, lon, mid_lat, mid_lon)
                    if dist <= radius:
                        direction = bearing_to_direction(lat, lon, mid_lat, mid_lon)
                        features.append({
                            "name": name,
                            "type": highway_type,
                            "distance_m": round(dist, 1),
                            "direction": direction,
                            "osm_id": element.id(),
                        })
        # Sort by distance
        features.sort(key=lambda x: x["distance_m"])
        return features
    except Exception as e:
        logger.error(f"[osm-overpass] Roads query failed: {e}")
        return []

def query_amenities(lat, lon, radius, amenity_types):
    """Query Overpass for amenities (schools, hospitals, etc.) near a point."""
    tools = get_osm_tools()
    if not tools:
        return []
    try:
        all_features = []
        for amenity in amenity_types:
            query = tools["overpassQueryBuilder"](
                area=None,
                bbox=[lat - 0.01, lon - 0.01, lat + 0.01, lon + 0.01],
                selector=f'"amenity"="{amenity}"',
                includeGeometry=True,
            )
            result = tools["Overpass"]().query(query)
            for element in result.elements():
                tags = element.tags() or {}
                name = tags.get("name") or tags.get("amenity", "").title()
                # Get coordinates
                if element.type() == "node":
                    el_lat = element.lat()
                    el_lon = element.lon()
                elif element.geometry():
                    coords = [(g["lat"], g["lon"]) for g in element.geometry()]
                    el_lat = sum(c[0] for c in coords) / len(coords)
                    el_lon = sum(c[1] for c in coords) / len(coords)
                else:
                    continue

                dist = haversine_distance(lat, lon, el_lat, el_lon)
                if dist <= radius:
                    direction = bearing_to_direction(lat, lon, el_lat, el_lon)
                    all_features.append({
                        "name": name,
                        "type": amenity,
                        "distance_m": round(dist, 1),
                        "direction": direction,
                        "osm_id": element.id(),
                    })
        all_features.sort(key=lambda x: x["distance_m"])
        return all_features
    except Exception as e:
        logger.error(f"[osm-overpass] Amenities query failed: {e}")
        return []

def query_natural(lat, lon, radius):
    """Query Overpass for natural features (water, forests) near a point."""
    tools = get_osm_tools()
    if not tools:
        return []
    try:
        features = []
        for tag in ["water", "waterway", "natural"]:
            query = tools["overpassQueryBuilder"](
                area=None,
                bbox=[lat - 0.01, lon - 0.01, lat + 0.01, lon + 0.01],
                selector=f'"{tag}"',
                includeGeometry=True,
            )
            result = tools["Overpass"]().query(query)
            for element in result.elements():
                tags = element.tags() or {}
                name = tags.get("name")
                if not name:
                    continue
                # Get centroid
                if element.type() == "node":
                    el_lat = element.lat()
                    el_lon = element.lon()
                elif element.geometry():
                    coords = [(g["lat"], g["lon"]) for g in element.geometry()]
                    el_lat = sum(c[0] for c in coords) / len(coords)
                    el_lon = sum(c[1] for c in coords) / len(coords)
                else:
                    continue

                dist = haversine_distance(lat, lon, el_lat, el_lon)
                if dist <= radius:
                    direction = bearing_to_direction(lat, lon, el_lat, el_lon)
                    feature_type = tags.get(tag, "natural")
                    features.append({
                        "name": name,
                        "type": feature_type,
                        "distance_m": round(dist, 1),
                        "direction": direction,
                        "osm_id": element.id(),
                    })
        features.sort(key=lambda x: x["distance_m"])
        return features
    except Exception as e:
        logger.error(f"[osm-overpass] Natural query failed: {e}")
        return []

def query_boundaries(lat, lon, radius):
    """Query Overpass for administrative boundaries near a point."""
    tools = get_osm_tools()
    if not tools:
        return []
    try:
        query = tools["overpassQueryBuilder"](
            area=None,
            bbox=[lat - 0.01, lon - 0.01, lat + 0.01, lon + 0.01],
            selector='"boundary"="administrative"',
            includeGeometry=True,
        )
        result = tools["Overpass"]().query(query)
        features = []
        for element in result.elements():
            tags = element.tags() or {}
            name = tags.get("name")
            admin_level = tags.get("admin_level")
            if not name:
                continue
            # Map admin_level to readable name
            level_names = {
                "2": "country",
                "4": "county",
                "5": "constituency",
                "6": "county/sub-county",
                "7": "division",
                "8": "ward",
                "9": "neighborhood",
                "10": "sub-location",
            }
            admin_type = level_names.get(admin_level, f"level-{admin_level}")
            features.append({
                "name": name,
                "type": admin_type,
                "admin_level": admin_level,
                "osm_id": element.id(),
            })
        return features
    except Exception as e:
        logger.error(f"[osm-overpass] Boundaries query failed: {e}")
        return []

# ─── Abuttals Auto-Population ───────────────────────────────────────────────

def auto_populate_abuttals(lat, lon, radius=200):
    """
    Auto-populate deed plan abuttals (N/S/E/W) based on nearby features.

    Returns a dict with north/south/east/west descriptions.
    """
    roads = query_roads(lat, lon, radius * 3)  # wider radius for roads
    natural = query_natural(lat, lon, radius * 3)

    def closest_in_direction(features, directions):
        """Find the closest feature in one of the given directions."""
        for f in features:
            if f.get("direction") in directions:
                return f
        return None

    north = closest_in_direction(roads + natural, ["N", "NE", "NW"])
    south = closest_in_direction(roads + natural, ["S", "SE", "SW"])
    east = closest_in_direction(roads + natural, ["E", "NE", "SE"])
    west = closest_in_direction(roads + natural, ["W", "NW", "SW"])

    def describe(feature):
        if not feature:
            return ""
        return f"{feature['name']} ({feature['distance_m']:.0f}m {feature['direction']})"

    return {
        "north": describe(north),
        "south": describe(south),
        "east": describe(east),
        "west": describe(west),
    }

# ─── API Models ─────────────────────────────────────────────────────────────

class NearbyFeaturesRequest(BaseModel):
    lat: float
    lon: float
    radius: int = 500  # meters
    feature_types: list = ["roads", "schools", "health", "water", "boundaries"]

class AbuttalsRequest(BaseModel):
    lat: float
    lon: float
    radius: int = 200

# ─── API Router ─────────────────────────────────────────────────────────────

overpass_router = APIRouter(prefix="/osm", tags=["osm-overpass"])

@overpass_router.post("/nearby-features")
async def api_nearby_features(request: NearbyFeaturesRequest):
    """
    Find named OSM features near a point using the Overpass API.

    Returns roads, schools, health facilities, water bodies, and
    administrative boundaries within the specified radius.
    """
    result = {
        "lat": request.lat,
        "lon": request.lon,
        "radius": request.radius,
        "osm_tools_available": get_osm_tools() is not None,
    }

    if "roads" in request.feature_types:
        result["roads"] = query_roads(request.lat, request.lon, request.radius)
    if "schools" in request.feature_types:
        result["schools"] = query_amenities(request.lat, request.lon, request.radius, ["school", "kindergarten", "college", "university"])
    if "health" in request.feature_types:
        result["health"] = query_amenities(request.lat, request.lon, request.radius, ["hospital", "clinic", "doctors", "pharmacy"])
    if "water" in request.feature_types:
        result["water"] = query_natural(request.lat, request.lon, request.radius)
    if "boundaries" in request.feature_types:
        result["boundaries"] = query_boundaries(request.lat, request.lon, request.radius)

    return result

@overpass_router.post("/auto-abuttals")
async def api_auto_abuttals(request: AbuttalsRequest):
    """
    Auto-populate deed plan abuttals (N/S/E/W) based on nearby OSM features.

    Returns a dict with north/south/east/west descriptions ready to
    paste into a deed plan.
    """
    if not get_osm_tools():
        raise HTTPException(
            status_code=503,
            detail="OSMPythonTools not installed. Run: pip install OSMPythonTools",
        )
    return auto_populate_abuttals(request.lat, request.lon, request.radius)
