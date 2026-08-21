FROM python:3.11-slim

# AUDIT FIX (C9, 2026-07-02): Install RTKLIB for GNSS baseline processing.
# RTKLIB's rnx2rtkp tool processes RINEX files and outputs baseline solutions.
# On Debian/Ubuntu, rtklib is available via apt. If not available, compile
# from source: https://github.com/rtklibexplorer/RTKLIB
RUN apt-get update && apt-get install -y --no-install-recommends \
    rtklib \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all Python modules — main.py imports these at startup:
#   gnss_processor.py   — GNSS RINEX processing (SPP/PPP, session QC)
#   surface_processor.py — Delaunay TIN, marching-triangle contours, grid volume
#   spatial_cache.py    — spatial data caching layer
COPY main.py gnss_processor.py surface_processor.py spatial_cache.py ./

# Non-root user for security
RUN groupadd --system --gid 1001 worker && \
    useradd --system --uid 1001 --gid worker worker && \
    chown -R worker:worker /app

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

USER worker
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
