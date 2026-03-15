from typing import List, Optional
from pydantic import BaseModel
import numpy as np


class Point2D(BaseModel):
    x: float
    y: float
    z: Optional[float] = 0.0


class ExportPoint(BaseModel):
    name: str
    x: float
    y: float
    z: Optional[float] = 0.0
    code: Optional[str] = ""


class ExportLine(BaseModel):
    name: str
    start: Point2D
    end: Point2D
    color: Optional[int] = 7


class ExportContour(BaseModel):
    elevation: float
    segments: List[List[List[float]]]


class DXFExportRequest(BaseModel):
    points: List[ExportPoint] = []
    lines: List[ExportLine] = []
    contours: List[ExportContour] = []
    title: str = "GeoNova Export"


def generate_dxf(request: DXFExportRequest) -> str:
    lines: List[str] = []

    lines.append("0")
    lines.append("SECTION")
    lines.append("2")
    lines.append("HEADER")
    lines.append("9")
    lines.append("$ACADVER")
    lines.append("1")
    lines.append("AC1014")
    lines.append("9")
    lines.append("$INSUNITS")
    lines.append("70")
    lines.append("6")
    lines.append("0")
    lines.append("ENDSEC")

    lines.append("0")
    lines.append("SECTION")
    lines.append("2")
    lines.append("ENTITIES")

    for point in request.points:
        lines.append("0")
        lines.append("POINT")
        lines.append("8")
        lines.append("POINTS")
        lines.append("10")
        lines.append(str(point.x))
        lines.append("20")
        lines.append(str(point.y))
        lines.append("30")
        lines.append(str(point.z))

    for line in request.lines:
        lines.append("0")
        lines.append("LINE")
        lines.append("8")
        lines.append("LINES")
        lines.append("62")
        lines.append(str(line.color))
        lines.append("10")
        lines.append(str(line.start.x))
        lines.append("20")
        lines.append(str(line.start.y))
        lines.append("30")
        lines.append(str(line.start.z))
        lines.append("11")
        lines.append(str(line.end.x))
        lines.append("21")
        lines.append(str(line.end.y))
        lines.append("31")
        lines.append(str(line.end.z))

    contour_color = 3
    for contour in request.contours:
        for segment in contour.segments:
            if len(segment) >= 2:
                lines.append("0")
                lines.append("LINE")
                lines.append("8")
                lines.append("CONTOURS")
                lines.append("62")
                lines.append(str(contour_color))
                lines.append("10")
                lines.append(str(segment[0][0]))
                lines.append("20")
                lines.append(str(segment[0][1]))
                lines.append("30")
                lines.append(str(contour.elevation))
                lines.append("11")
                lines.append(str(segment[1][0]))
                lines.append("21")
                lines.append(str(segment[1][1]))
                lines.append("31")
                lines.append(str(contour.elevation))

    lines.append("0")
    lines.append("ENDSEC")
    lines.append("0")
    lines.append("EOF")

    return "\n".join(lines)


class KMLExportRequest(BaseModel):
    points: List[ExportPoint] = []
    lines: List[ExportLine] = []
    name: str = "GeoNova Export"


def generate_kml(request: KMLExportRequest) -> str:
    lines: List[str] = []

    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<kml xmlns="http://www.opengis.net/kml/2.2">')
    lines.append("<Document>")
    lines.append(f"<name>{request.name}</name>")

    for point in request.points:
        lines.append("<Placemark>")
        lines.append(f"<name>{point.name}</name>")
        if point.code:
            lines.append(f"<description>{point.code}</description>")
        lines.append("<Point>")
        lines.append(f"<coordinates>{point.x},{point.y},{point.z}</coordinates>")
        lines.append("</Point>")
        lines.append("</Placemark>")

    for line in request.lines:
        lines.append("<Placemark>")
        lines.append(f"<name>{line.name}</name>")
        lines.append("<LineString>")
        coords = f"{line.start.x},{line.start.y},{line.start.z} {line.end.x},{line.end.y},{line.end.z}"
        lines.append(f"<coordinates>{coords}</coordinates>")
        lines.append("</LineString>")
        lines.append("</Placemark>")

    lines.append("</Document>")
    lines.append("</kml>")

    return "\n".join(lines)


class GeoJSONExportRequest(BaseModel):
    points: List[ExportPoint] = []
    lines: List[ExportLine] = []
    name: str = "GeoNova Export"


def generate_geojson(request: GeoJSONExportRequest) -> dict:
    features = []

    for point in request.points:
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [point.x, point.y, point.z],
                },
                "properties": {"name": point.name, "code": point.code or ""},
            }
        )

    for line in request.lines:
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [line.start.x, line.start.y, line.start.z],
                        [line.end.x, line.end.y, line.end.z],
                    ],
                },
                "properties": {"name": line.name},
            }
        )

    return {"type": "FeatureCollection", "name": request.name, "features": features}
