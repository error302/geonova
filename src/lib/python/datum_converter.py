import sys
import json
from pyproj import Transformer

def wgs84_to_arc1960_utm37(easting: float, northing: float) -> dict:
    transformer = Transformer.from_crs('EPSG:4326', 'EPSG:21037', always_xy=True)
    x, y = transformer.transform(easting, northing)
    return {'easting': round(x, 3), 'northing': round(y, 3), 'datum': 'ARC1960', 'epsg': 21037}

def arc1960_to_wgs84_utm37(easting: float, northing: float) -> dict:
    transformer = Transformer.from_crs('EPSG:21037', 'EPSG:4326', always_xy=True)
    lon, lat = transformer.transform(easting, northing)
    return {'longitude': round(lon, 6), 'latitude': round(lat, 6), 'datum': 'WGS84', 'epsg': 4326}

def batch_convert(coords: list, from_datum: str, to_datum: str) -> list:
    results = []
    for c in coords:
        lat, lon = c.get('latitude', 0), c.get('longitude', 0)
        e, n = c.get('easting', 0), c.get('northing', 0)
        cid = c.get('id', '')
        if from_datum == 'WGS84' and to_datum == 'ARC1960':
            r = wgs84_to_arc1960_utm37(lon, lat)
            results.append({'id': cid, 'easting': r['easting'], 'northing': r['northing'], 'datum': r['datum']})
        elif from_datum == 'ARC1960' and to_datum == 'WGS84':
            r = arc1960_to_wgs84_utm37(e, n)
            results.append({'id': cid, 'longitude': r['longitude'], 'latitude': r['latitude'], 'datum': r['datum']})
        else:
            results.append(c)
    return results

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--coords', type=str, required=True, help='JSON array of {easting, northing, id}')
    parser.add_argument('--from', dest='from_datum', default='WGS84')
    parser.add_argument('--to', dest='to_datum', default='ARC1960')
    args = parser.parse_args()
    coords = json.loads(args.coords)
    results = batch_convert(coords, args.from_datum, args.to_datum)
    print(json.dumps(results))
