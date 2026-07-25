# OpenStreetMap Integration — Setup Guide

METARDU integrates 4 Python OSM libraries to give surveyors OSM context (buildings, roads, POIs, named features) directly in the map page and deed plan generator.

## What's Included

| Library | Purpose | When to Use |
|---------|---------|-------------|
| **Pyrosm** | Fast local PBF parsing | Map page building footprints, road names, POIs by bounding box |
| **Pyosmium** | Streaming PBF processor | Memory-efficient extract for large areas (county, country) |
| **OSMPythonTools** | Overpass API queries | Deed plan abuttals auto-fill ("bounded on the north by Mombasa Road") |
| **osm2geojson** | OSM JSON → GeoJSON conversion | Glue library for raw Overpass responses |

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd python_worker
pip install -r requirements.txt
```

This installs Pyrosm, Pyosmium, OSMPythonTools, osm2geojson, GeoPandas, and Shapely.

### 2. Download Kenya PBF Extract

```bash
mkdir -p data
wget https://download.geofabrik.de/africa/kenya-latest.osm.pbf -O data/kenya-latest.osm.pbf
```

The Kenya extract is ~450MB. It contains all OSM data for Kenya: buildings, roads, POIs, natural features, administrative boundaries.

Alternatively, set the `OSM_PBF_PATH` environment variable:
```bash
export OSM_PBF_PATH=/path/to/your/extract.osm.pbf
```

### 3. Start the Python Worker

```bash
cd python_worker
uvicorn main:app --port 8001 --reload
```

The worker auto-detects the PBF file on first request and caches it in memory (~2-3GB RAM for Kenya). Subsequent requests are fast.

### 4. Set Environment Variables

In your `.env`:
```env
PYTHON_WORKER_URL=http://localhost:8001
WORKER_SECRET=your-secret-here
```

### 5. Verify It Works

```bash
# Check worker status
curl http://localhost:8001/osm/status -H "X-Worker-Secret: your-secret-here"

# Get buildings in a bounding box (Nairobi CBD)
curl "http://localhost:8001/osm/features?minlon=36.8&minlat=-1.3&maxlon=36.85&maxlat=-1.25&types=buildings" \
  -H "X-Worker-Secret: your-secret-here"
```

## Features

### Map Page: OSM Buildings Layer

Click the 🏗 "OSM Buildings" button (top-right of map) to toggle building footprints. Buildings load automatically as you pan/zoom, served from the local PBF.

- Building polygons render in semi-transparent orange (METARDU brand color)
- Loading indicator shows count of features in current view
- Gracefully degrades if worker is offline (button still shows, but no buildings)

### Deed Plan Generator: Auto-fill Abuttals

In the Deed Plan Generator input step, click "Auto-fill from OSM" next to the Abuttals heading. The system:

1. Computes the parcel centroid from boundary points
2. Converts UTM coordinates to WGS84 lat/lon
3. Queries Overpass API for named features within 300m
4. Populates N/S/E/W abuttal fields with the closest road or natural feature in each direction

Example output:
- **North:** Mombasa Road (120m NE)
- **South:** Access road reserve (45m S)
- **East:** Kitengela Primary School (280m E)
- **West:** River Athi (180m W)

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/osm/features` | GET | Get OSM features by bounding box (Pyrosm) |
| `/api/osm/nearby-features` | POST | Find named features near a point (Overpass) |
| `/api/osm/auto-abuttals` | POST | Auto-populate deed plan abuttals (Overpass) |
| `/api/osm/status` | GET | Check if worker + PBF are ready |

### Python Worker Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/osm/features` | GET | Pyrosm local PBF parsing |
| `/osm/status` | GET | Check PBF load state |
| `/osm/stream-extract` | POST | Pyosmium streaming extract to file |
| `/osm/nearby-features` | POST | OSMPythonTools Overpass query |
| `/osm/auto-abuttals` | POST | Auto-populate N/S/E/W abuttals |

## Memory Requirements

- **Pyrosm (PBF in memory):** ~2-3GB RAM for Kenya extract
- **Pyosmium (streaming):** <100MB RAM (processes node-by-node)
- **OSMPythonTools (Overpass):** <50MB RAM (queries external API)

If RAM is limited, use Pyosmium streaming (`/osm/stream-extract`) to pre-extract subsets, or skip the PBF and use only Overpass queries.

## Troubleshooting

### "Python worker offline"
- Check that the worker is running: `curl http://localhost:8001/health`
- Verify `PYTHON_WORKER_URL` in `.env`

### "PBF file not found"
- Download Kenya PBF: `wget https://download.geofabrik.de/africa/kenya-latest.osm.pbf -O data/kenya-latest.osm.pbf`
- Or set `OSM_PBF_PATH` env var

### "OSMPythonTools not installed"
- Run: `pip install OSMPythonTools`
- OSMPythonTools has heavier dependencies (requests, babel) — install separately if needed

### Overpass rate limits
OSMPythonTools queries the public Overpass API. For heavy use:
1. Set up a local Overpass server: https://wiki.openstreetmap.org/wiki/Overpass_API/Installation
2. Or use Pyrosm for bulk feature extraction (no rate limits, local PBF)
