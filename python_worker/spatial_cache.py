import sqlite3
import json
import time
import logging
import os

logger = logging.getLogger(__name__)

class SpatialCache:
    def __init__(self, db_path="osm_cache.db", ttl_seconds=7 * 24 * 3600):
        # Default TTL is 7 days
        self.db_path = os.path.join(os.path.dirname(__file__), db_path)
        self.ttl_seconds = ttl_seconds
        self._init_db()

    def _init_db(self):
        """Initialize the SQLite database with the bbox_cache table."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS bbox_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        min_lat REAL,
                        min_lon REAL,
                        max_lat REAL,
                        max_lon REAL,
                        geojson TEXT,
                        timestamp REAL
                    )
                ''')
                # Create index for faster spatial lookups
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_bbox ON bbox_cache 
                    (min_lat, max_lat, min_lon, max_lon)
                ''')
                conn.commit()
            logger.info(f"[spatial_cache] Initialized SpatialCache at {self.db_path} (TTL: {self.ttl_seconds}s)")
        except Exception as e:
            logger.error(f"[spatial_cache] Failed to initialize DB: {e}")

    def _purge_expired(self):
        """Purge cached bounding boxes that have exceeded the TTL."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                expiry_time = time.time() - self.ttl_seconds
                cursor = conn.execute("DELETE FROM bbox_cache WHERE timestamp < ?", (expiry_time,))
                deleted = cursor.rowcount
                conn.commit()
                if deleted > 0:
                    logger.info(f"[spatial_cache] Purged {deleted} expired cache entries.")
        except Exception as e:
            logger.error(f"[spatial_cache] Failed to purge expired entries: {e}")

    def get_cached_geojson(self, req_min_lat, req_min_lon, req_max_lat, req_max_lon):
        """
        Check if the requested bounding box is entirely encapsulated by a cached bounding box.
        If it is, return the cached GeoJSON.
        """
        self._purge_expired()
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Find a cached bbox that completely encompasses the requested bbox
                cursor = conn.execute('''
                    SELECT geojson FROM bbox_cache 
                    WHERE min_lat <= ? AND max_lat >= ? AND min_lon <= ? AND max_lon >= ?
                    ORDER BY timestamp DESC LIMIT 1
                ''', (req_min_lat, req_max_lat, req_min_lon, req_max_lon))
                row = cursor.fetchone()
                if row:
                    logger.info("[spatial_cache] Cache HIT.")
                    return json.loads(row[0])
                logger.info("[spatial_cache] Cache MISS.")
                return None
        except Exception as e:
            logger.error(f"[spatial_cache] Failed to read from cache: {e}")
            return None

    def set_cached_geojson(self, min_lat, min_lon, max_lat, max_lon, geojson_data):
        """Store the GeoJSON for the fetched bounding box."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT INTO bbox_cache (min_lat, min_lon, max_lat, max_lon, geojson, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (min_lat, min_lon, max_lat, max_lon, json.dumps(geojson_data), time.time()))
                conn.commit()
            logger.info("[spatial_cache] Cached new bounding box GeoJSON.")
        except Exception as e:
            logger.error(f"[spatial_cache] Failed to write to cache: {e}")
