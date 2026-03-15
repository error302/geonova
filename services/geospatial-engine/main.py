from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from processing.terrain import TINRequest, TINResponse, compute_tin
from processing.volume import VolumeRequest, VolumeResponse, calculate_volume
from processing.raster import (
    RasterAnalysisRequest,
    RasterAnalysisResponse,
    analyze_raster,
)
from processing.contours import (
    ContourRequest,
    ContourResponse,
    generate_contours,
)
from processing.export import (
    DXFExportRequest,
    generate_dxf,
    KMLExportRequest,
    generate_kml,
    GeoJSONExportRequest,
    generate_geojson,
)

app = FastAPI(title="GeoNova Geospatial Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"service": "GeoNova Geospatial Engine", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/surface/tin", response_model=TINResponse)
def surface_tin(request: TINRequest):
    try:
        return compute_tin(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/surface/volume", response_model=VolumeResponse)
def surface_volume(request: VolumeRequest):
    try:
        return calculate_volume(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/hydro/seabed")
def hydro_seabed(data: dict):
    try:
        points = data.get("points", [])

        if not points:
            return {
                "depth_min": 0,
                "depth_max": 0,
                "depth_mean": 0,
                "volume": 0,
                "area": 0,
            }

        depths = [p.get("depth", 0) for p in points]

        import numpy as np

        depths_array = np.array(depths)

        return {
            "depth_min": float(np.min(depths_array)),
            "depth_max": float(np.max(depths_array)),
            "depth_mean": float(np.mean(depths_array)),
            "volume": float(np.sum(depths_array)),
            "area": len(points),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/raster/analyze", response_model=RasterAnalysisResponse)
def raster_analyze(request: RasterAnalysisRequest):
    try:
        return analyze_raster(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/terrain/contours", response_model=ContourResponse)
def terrain_contours(request: ContourRequest):
    try:
        return generate_contours(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export/dxf")
def export_dxf(request: DXFExportRequest):
    try:
        dxf_content = generate_dxf(request)
        return {"content": dxf_content, "filename": f"{request.title}.dxf"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export/kml")
def export_kml(request: KMLExportRequest):
    try:
        kml_content = generate_kml(request)
        return {"content": kml_content, "filename": f"{request.name}.kml"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export/geojson")
def export_geojson(request: GeoJSONExportRequest):
    try:
        geojson = generate_geojson(request)
        return geojson
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
