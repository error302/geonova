"""
METARDU OSM Streaming Processor — Pyosmium-based

PROBLEM
-------
Pyrosm loads the entire PBF into memory (~2-3GB for Kenya). For planet-scale
extracts, multi-country analyses, or running on a small VM, this isn't viable.

Pyosmium streams through the PBF file node-by-node, way-by-way, relation-by-
relation — never loading the whole file into memory. This lets us:
  - Process files larger than RAM
  - Filter on tags as we go (write only matching features to output)
  - Assemble multipolygon relations correctly (Pyrosm can't)
  - Build custom extract pipelines for production data workflows

LIBRARY: Pyosmium (https://osmcode.org/pyosmium/)
- Python binding for libosmium (C++)
- Used by OpenStreetMap tooling (osmium-tool, osmium-js)
- Handler-based API: write a class that receives nodes/ways/relations

USE CASES IN METARDU
--------------------
1. Generate a "buildings-only" extract for a project area (smaller PBF)
2. Build a county-level extract from the national PBF
3. Extract specific feature types (e.g., all schools in Kenya) for offline use
4. Pre-process OSM data into GeoParquet for fast DuckDB queries

USAGE
-----
POST /osm/stream-extract
{
  "output_path": "data/nairobi-buildings.geojson",
  "bbox": [36.5, -1.5, 37.0, -1.0],
  "filters": {
    "buildings": true,
    "roads": ["motorway", "trunk", "primary"],
    "pois": ["school", "hospital", "clinic"]
  }
}
"""

import os
import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ─── Lazy Pyosmium Import ───────────────────────────────────────────────────

_osmium = None

def get_osmium():
    """Lazy-import osmium. Returns None if not installed."""
    global _osmium
    if _osmium is None:
        try:
            import osmium
            _osmium = osmium
            logger.info("[osm-stream] Pyosmium loaded successfully")
        except ImportError:
            logger.warning("[osm-stream] Pyosmium not installed. Streaming disabled.")
            _osmium = False
    return _osmium if _osmium is not False else None

# ─── Handler Classes ────────────────────────────────────────────────────────

class BuildingHandler:
    """Pyosmium handler that collects building footprints."""

    def __init__(self, bbox=None):
        self.features = []
        self.bbox = bbox  # (minlon, minlat, maxlon, maxlat) or None
        self.count = 0

    def _in_bbox(self, lon, lat):
        if not self.bbox:
            return True
        return (self.bbox[0] <= lon <= self.bbox[2] and
                self.bbox[1] <= lat <= self.bbox[3])

    def way(self, w):
        """Process a way (line/polygon defined by node references)."""
        if "building" not in w.tags:
            return
        # Get coordinates (Pyosmium provides location if nodes are in the file)
        coords = []
        for node in w.nodes:
            lon, lat = node.lon, node.lat
            if not self._in_bbox(lon, lat):
                return  # skip if any node is outside bbox
            coords.append([lon, lat])

        if len(coords) < 4:
            return  # not a valid polygon

        # Ensure closed ring
        if coords[0] != coords[-1]:
            coords.append(coords[0])

        tags = {tag.k: tag.v for tag in w.tags}
        self.features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords],
            },
            "properties": {
                "id": w.id,
                **tags,
            },
        })
        self.count += 1

class RoadHandler:
    """Pyosmium handler that collects road lines."""

    def __init__(self, bbox=None, road_types=None):
        self.features = []
        self.bbox = bbox
        self.road_types = road_types or [
            "motorway", "trunk", "primary", "secondary", "tertiary",
            "residential", "unclassified",
        ]
        self.count = 0

    def _in_bbox(self, lon, lat):
        if not self.bbox:
            return True
        return (self.bbox[0] <= lon <= self.bbox[2] and
                self.bbox[1] <= lat <= self.bbox[3])

    def way(self, w):
        if "highway" not in w.tags:
            return
        highway_type = w.tags.get("highway")
        if highway_type not in self.road_types:
            return

        coords = []
        for node in w.nodes:
            lon, lat = node.lon, node.lat
            if self._in_bbox(lon, lat):
                coords.append([lon, lat])

        if len(coords) < 2:
            return

        tags = {tag.k: tag.v for tag in w.tags}
        self.features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
            "properties": {
                "id": w.id,
                **tags,
            },
        })
        self.count += 1

class POIHandler:
    """Pyosmium handler that collects points of interest."""

    def __init__(self, bbox=None, poi_types=None):
        self.features = []
        self.bbox = bbox
        self.poi_types = poi_types  # list of amenity values, or None for all
        self.count = 0

    def _in_bbox(self, lon, lat):
        if not self.bbox:
            return True
        return (self.bbox[0] <= lon <= self.bbox[2] and
                self.bbox[1] <= lat <= self.bbox[3])

    def node(self, n):
        if "amenity" not in n.tags:
            return
        amenity_type = n.tags.get("amenity")
        if self.poi_types and amenity_type not in self.poi_types:
            return

        lon, lat = n.location.lon, n.location.lat
        if not self._in_bbox(lon, lat):
            return

        tags = {tag.k: tag.v for tag in n.tags}
        self.features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
            "properties": {
                "id": n.id,
                **tags,
            },
        })
        self.count += 1

# ─── Streaming Processor ────────────────────────────────────────────────────

def stream_extract(
    pbf_path: str,
    output_path: str,
    bbox: Optional[list] = None,
    filters: Optional[dict] = None,
) -> dict:
    """
    Stream through a PBF file and extract features to a GeoJSON file.

    This is memory-efficient: only the matching features are held in memory,
    not the entire PBF.

    Args:
        pbf_path: Path to the .osm.pbf file
        output_path: Where to write the output GeoJSON
        bbox: Optional [minlon, minlat, maxlon, maxlat] bounding box
        filters: Optional dict specifying what to extract:
            {
                "buildings": true,
                "roads": ["motorway", "trunk", "primary"],
                "pois": ["school", "hospital", "clinic"]
            }

    Returns:
        Summary dict with counts and output path
    """
    osmium = get_osmium()
    if not osmium:
        return {"error": "Pyosmium not installed"}

    if not os.path.exists(pbf_path):
        return {"error": f"PBF file not found: {pbf_path}"}

    filters = filters or {}
    all_features = []

    # Buildings
    if filters.get("buildings"):
        logger.info(f"[osm-stream] Extracting buildings from {pbf_path}...")
        handler = BuildingHandler(bbox=bbox)
        osmium.run(osmium.io.Reader(pbf_path), handler)
        all_features.extend(handler.features)
        logger.info(f"[osm-stream] Buildings: {handler.count}")

    # Roads
    if filters.get("roads"):
        logger.info(f"[osm-stream] Extracting roads from {pbf_path}...")
        road_types = filters["roads"] if isinstance(filters["roads"], list) else None
        handler = RoadHandler(bbox=bbox, road_types=road_types)
        osmium.run(osmium.io.Reader(pbf_path), handler)
        all_features.extend(handler.features)
        logger.info(f"[osm-stream] Roads: {handler.count}")

    # POIs
    if filters.get("pois"):
        logger.info(f"[osm-stream] Extracting POIs from {pbf_path}...")
        poi_types = filters["pois"] if isinstance(filters["pois"], list) else None
        handler = POIHandler(bbox=bbox, poi_types=poi_types)
        osmium.run(osmium.io.Reader(pbf_path), handler)
        all_features.extend(handler.features)
        logger.info(f"[osm-stream] POIs: {handler.count}")

    # Write output
    output = {
        "type": "FeatureCollection",
        "features": all_features,
    }
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f)

    return {
        "success": True,
        "output_path": output_path,
        "total_features": len(all_features),
        "buildings": sum(1 for ft in all_features if ft["properties"].get("building")),
        "roads": sum(1 for ft in all_features if ft["properties"].get("highway")),
        "pois": sum(1 for ft in all_features if ft["properties"].get("amenity")),
    }

# ─── API Models ─────────────────────────────────────────────────────────────

class StreamExtractRequest(BaseModel):
    output_path: str
    bbox: Optional[list] = None  # [minlon, minlat, maxlon, maxlat]
    filters: Optional[dict] = None

# ─── API Router ─────────────────────────────────────────────────────────────

stream_router = APIRouter(prefix="/osm", tags=["osm-stream"])

@stream_router.post("/stream-extract")
async def api_stream_extract(request: StreamExtractRequest):
    """
    Stream-extract features from the PBF file to a GeoJSON file.

    Memory-efficient: processes the PBF node-by-node without loading
    the whole file into RAM. Suitable for planet-scale extracts.
    """
    # Find the PBF file
    pbf_path = (
        os.environ.get("OSM_PBF_PATH") or
        ("data/kenya-latest.osm.pbf" if os.path.exists("data/kenya-latest.osm.pbf") else None)
    )
    if not pbf_path:
        raise HTTPException(
            status_code=503,
            detail="No PBF file found. Set OSM_PBF_PATH or place file at data/kenya-latest.osm.pbf",
        )

    result = stream_extract(
        pbf_path=pbf_path,
        output_path=request.output_path,
        bbox=request.bbox,
        filters=request.filters,
    )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result
