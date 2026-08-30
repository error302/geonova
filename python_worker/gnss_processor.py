"""
METARDU GNSS Processor — REAL RINEX processing (SPP engine)

Replaces the pre-2026-08-31 state where parse_rinex_nav()/parse_sp3() were
empty stubs, compute_sat_position() mixed up seconds-of-day with
seconds-of-week, and compute_ppp() fabricated a satellite ring. This module
implements genuine code-based GNSS positioning end to end:

  - RINEX 2.10-2.11 and 3.0x observation parsing (pure Python, tolerant of
    real-world encoder quirks such as >14-char field values and >80-char
    lines; gzip and Hatanaka inputs supported)
  - RINEX 2/3 navigation parsing (broadcast ephemeris: GPS + Galileo)
  - IS-GPS-200 satellite position/clock evaluation (Kepler solver, harmonic
    corrections, relativistic clock, TGD/BGD group delays, Sagnac rotation)
  - SP3 precise ephemeris parsing + Lagrange interpolation (orbits and clocks)
  - Multi-epoch weighted least-squares SPP with:
      * per-system receiver clocks (GPS / Galileo)
      * ionosphere-free dual-frequency combination when L1+L2/L5 code exist
      * Klobuchar ionosphere for single-frequency solutions when the nav
        message carries ION ALPHA / ION BETA
      * Saastamoinen hydrostatic troposphere with 1/sin(E) mapping
      * elevation-dependent observation weighting
      * 3.5-sigma outlier rejection (max 2 passes)
  - Automatic ephemeris acquisition when the user provides no nav file:
      * broadcast BRDC (igs.bkg.bund.de mirror — anonymous access)
      * IGS SP3 final/rapid/ultra-rapid (geodesy.noaa.gov CORS mirror)
  - Honest labeling: methods are SPP / SPP-IF / SPP-SP3 — this module NEVER
    claims PPP (carrier-phase ambiguities are not estimated) and NEVER
    fabricates satellite geometry. Missing ephemerides are a hard error.

Accuracy expectations (honest, stated in results.accuracy_note):
  SPP      (L1 code, broadcast eph)      ~3-10 m horizontal (95%)
  SPP-IF   (IF code, broadcast eph)      ~2-6 m horizontal
  SPP-SP3  (IF code, IGS precise orbits+clocks) ~0.5-2 m horizontal
Survey-grade work must use the RTKLIB baseline processor instead.

Dependencies: numpy, requests (both in python_worker/requirements.txt).
georinex is NOT required for parsing, but its bundled `crx2rnx` binary is
used opportunistically to decompress Hatanaka files when available.

References:
  - IS-GPS-200 rev N, 20.3.3.3.3.1 (ephemeris), 20.3.3.3.3.2 (clock)
  - RINEX 3.05 spec (igs.org/pub/data/format/rinex305.pdf)
  - RINEX 2.11 spec
  - Kouba & Héroux (2001), GPS Solutions 5(2)
  - Saastamoinen (1972); Klobuchar (1987) GPS ionosphere model
  - IGS product naming: https://igs.org/products/
"""

from __future__ import annotations

import base64
import gzip
import io
import math
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import numpy as np

try:
    import requests
    HAS_REQUESTS = True
except ImportError:  # pragma: no cover - requests is in requirements.txt
    HAS_REQUESTS = False


# ─── Constants ──────────────────────────────────────────────────────────────

SPEED_OF_LIGHT = 299792458.0            # m/s
GPS_PI = 3.14159265358979310            # IS-GPS-200 constant
GPS_OMEGA_E = 7.2921151467e-5           # rad/s
WGS84_A = 6378137.0
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = 2.0 * WGS84_F - WGS84_F * WGS84_F

# Gravitational parameters (m^3/s^2)
MU_GPS = 3.986005e14                    # IS-GPS-200
MU_GALILEO = 3.986004418e14             # Galileo OSS ICD

# Relativistic clock constant F = -2*sqrt(mu)/c^2  [s/m^0.5]
F_REL_GPS = -2.0 * math.sqrt(MU_GPS) / SPEED_OF_LIGHT ** 2
F_REL_GAL = -2.0 * math.sqrt(MU_GALILEO) / SPEED_OF_LIGHT ** 2

# Carrier frequencies (Hz)
FREQ = {
    ("G", 1): 1575.42e6, ("G", 2): 1227.60e6, ("G", 5): 1176.45e6,
    ("E", 1): 1575.42e6, ("E", 5): 1176.45e6, ("E", 7): 1207.14e6,
    ("E", 6): 1278.75e6, ("E", 8): 1191.795e6,
}

# Anonymous ephemeris mirrors (verified reachable 2026-08-30)
BRDC_URL = ("https://igs.bkg.bund.de/root_ftp/IGS/BRDC/{year}/{doy:03d}/"
            "BRDC00WRD_R_{year}{doy:03d}0000_01D_MN.rnx.gz")
BKG_PRODUCT_URL = "https://igs.bkg.bund.de/root_ftp/IGS/products/{week}/"
NOAA_SP3_URL = ("https://geodesy.noaa.gov/corsdata/rinex/{year}/{doy:03d}/"
                "{name}")
SP3_PRODUCTS = (
    # (label, name-template) — tried in order; ULTRA has 4 issue times/day
    ("IGS final",     "IGS0OPSFIN_{y}{d}0000_01D_15M_ORB.SP3.gz"),
    ("IGS rapid",     "IGS0OPSRAP_{y}{d}0000_01D_15M_ORB.SP3.gz"),
    ("IGS ultra-rapid", "IGS0OPSULT_{y}{d}0000_02D_15M_ORB.SP3.gz"),
    ("IGS ultra-rapid", "IGS0OPSULT_{y}{d}0600_02D_15M_ORB.SP3.gz"),
    ("IGS ultra-rapid", "IGS0OPSULT_{y}{d}1200_02D_15M_ORB.SP3.gz"),
    ("IGS ultra-rapid", "IGS0OPSULT_{y}{d}1800_02D_15M_ORB.SP3.gz"),
)

DOWNLOAD_TIMEOUT = (5.0, 30.0)           # connect, read (s)
EPHEM_CACHE_TTL = 6 * 3600.0            # 6 h in-process cache for downloads

DEFAULT_ELEV_MASK = 10.0                # degrees
MAX_EPOCHS_PROCESSED = 3000             # subsample beyond this
MAX_INPUT_BYTES = 64 * 1024 * 1024      # 64 MiB decoded cap
BROADCAST_EPH_MAX_AGE = 3.0 * 3600.0    # s from toe (fit interval guard)
KEPLER_TOL = 1e-13
KEPLER_MAX_ITER = 30

# Supported systems: GPS (Kepler, GPST) and Galileo (Kepler, GST≈GPST).
# GLONASS (PZ-90, ephemeris = state vector, UTC time scale) and BeiDou
# (BDT offset -14 s vs GPST) are intentionally NOT solved; observations for
# them are skipped with a warning. Adding them requires their own time- and
# force-model handling — pretending they are GPS would be dishonest math.
SUPPORTED_SYSTEMS = ("G", "E")


# ─── GPS time helpers ───────────────────────────────────────────────────────

GPS_EPOCH = datetime(1980, 1, 6)        # naive == GPS time scale
GPS_WEEK_SECONDS = 604800.0


def gps_seconds(dt: datetime) -> float:
    """Absolute seconds since the GPS epoch (GPS time scale, no leap secs).

    RINEX observation epochs are GPS time for GPS/Galileo files, so no
    leap-second conversion is applied — converting would be wrong.
    """
    return (dt.replace(tzinfo=None) - GPS_EPOCH).total_seconds()


def gps_week_and_sow(dt: datetime) -> tuple[int, float]:
    """Return (GPS week number, seconds-of-week) for a GPS-time datetime."""
    secs = gps_seconds(dt)
    week = int(math.floor(secs / GPS_WEEK_SECONDS))
    sow = secs - week * GPS_WEEK_SECONDS
    return week, sow


def datetime_from_gps_seconds(secs: float) -> datetime:
    return GPS_EPOCH + timedelta(seconds=secs)


# ─── Small geometry helpers ─────────────────────────────────────────────────

def ecef_to_geodetic(x: float, y: float, z: float) -> tuple[float, float, float]:
    """ECEF (m) → (lat deg, lon deg, ellipsoidal h m). Closed-form Bowring."""
    a, f = WGS84_A, WGS84_F
    e2 = 2 * f - f * f
    b = a * (1 - f)
    p = math.hypot(x, y)
    if p < 1e-9:
        lat = math.copysign(math.pi / 2.0, z)
        lon = 0.0
    else:
        theta = math.atan2(z * a, p * b)
        lat = math.atan2(z + (a * a - b * b) / b * math.sin(theta) ** 3,
                         p - e2 * a * math.cos(theta) ** 3)
        lon = math.atan2(y, x)
    sin_lat = math.sin(lat)
    n = a / math.sqrt(1.0 - e2 * sin_lat * sin_lat)
    h = p / math.cos(lat) - n if abs(math.cos(lat)) > 1e-12 else z * math.copysign(1.0, lat) - n * (1 - e2) ** 0.5
    return math.degrees(lat), math.degrees(lon), h


def geodetic_to_ecef(lat_deg: float, lon_deg: float, h: float) -> tuple[float, float, float]:
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    e2 = WGS84_E2
    n = WGS84_A / math.sqrt(1.0 - e2 * math.sin(lat) ** 2)
    x = (n + h) * math.cos(lat) * math.cos(lon)
    y = (n + h) * math.cos(lat) * math.sin(lon)
    z = (n * (1 - e2) + h) * math.sin(lat)
    return x, y, z


def ecef_delta_to_enu(dx: float, dy: float, dz: float,
                      lat_deg: float, lon_deg: float) -> tuple[float, float, float]:
    """Rotate an ECEF difference vector into local East/North/Up."""
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    sl, cl = math.sin(lat), math.cos(lat)
    so, co = math.sin(lon), math.cos(lon)
    e = -so * dx + co * dy
    n = -sl * co * dx - sl * so * dy + cl * dz
    u = cl * co * dx + cl * so * dy + sl * dz
    return e, n, u


def saastamoinen_zenith(lat_deg: float, height_m: float) -> float:
    """Saastamoinen hydrostatic zenith delay (m) with standard atmosphere.

    Total (hydrostatic + mean wet) is returned: for code SPP the wet term's
    uncertainty (~5 cm) is far below observation noise, so a fixed wet
    estimate of 0.12 m is folded in and documented. The standard-atmosphere
    exponent argument is clamped so absurd heights (diverged iterations)
    cannot produce complex pressures — Python returns complex for
    negative_base ** fraction, which silently poisons the whole solver.
    """
    lat = math.radians(lat_deg)
    h_km = max(0.0, height_m) / 1000.0
    # Standard-atmosphere pressure at height (hPa)
    base = max(0.0, 1.0 - 2.25577e-5 * max(0.0, height_m))
    p = 1013.25 * base ** 5.225
    zh = 0.0022768 * p / (1.0 - 2.66e-3 * math.cos(2 * lat) + 2.8e-7 * h_km)
    return zh + 0.12  # + nominal wet delay


# ─── Klobuchar ionosphere (single-frequency) ────────────────────────────────

def klobuchar_delay(alpha: list[float], beta: list[float],
                    lat_deg: float, lon_deg: float,
                    elev_deg: float, az_deg: float,
                    gps_sow: float) -> float:
    """Klobuchar (1987) ionospheric L1 slant delay in metres.

    Follows IS-GPS-200 20.3.3.5.2.5 with the spec's semicircle angle
    convention. `alpha`/`beta` are the four coefficients from the RINEX nav
    header (GPS ION ALPHA / ION BETA, in seconds and seconds-per-semicircle
    powers). Removes typically ~50% of the true ionospheric delay — the
    residual is folded into the single-frequency accuracy statement.
    """
    if elev_deg <= 0.0:
        return 0.0
    lat_semi = lat_deg / 180.0
    lon_semi = lon_deg / 180.0
    e_semi = elev_deg / 90.0
    f = 1.0 + 16.0 * (0.53 - e_semi) ** 3
    psi = 0.0137 / (e_semi + 0.11) - 0.022
    phi_i = lat_semi + psi * math.cos(math.radians(az_deg))
    phi_i = max(-0.416, min(0.416, phi_i))
    lam_i = lon_semi + psi * math.sin(math.radians(az_deg)) / max(1e-9, math.cos(phi_i * math.pi))
    phi_m = phi_i + 0.064 * math.cos(lam_i * math.pi - 1.617)
    t = (4.32e4 * lam_i + gps_sow) % 86400.0
    amp = (alpha[0] + alpha[1] * phi_m + alpha[2] * phi_m ** 2
           + alpha[3] * phi_m ** 3)
    per = (beta[0] + beta[1] * phi_m + beta[2] * phi_m ** 2
           + beta[3] * phi_m ** 3)
    amp = max(0.0, amp)
    per = max(72000.0, per)
    x = 2.0 * math.pi * (t - 50400.0) / per
    if abs(x) < math.pi / 2.0:
        cos_series = max(0.0, 1.0 - x * x / 2.0 + x ** 4 / 24.0)
        t_iono = f * (5e-9 + amp * cos_series)
    else:
        t_iono = f * 5e-9
    return t_iono * SPEED_OF_LIGHT

# ═══════════════════════════════════════════════════════════════════════════
# RINEX OBSERVATION PARSING (versions 2.10/2.11 and 3.0x)
# ═══════════════════════════════════════════════════════════════════════════

# Values in RINEX observation records always carry a decimal point (F14.3
# or finer); bare single digits are LLI/SSI flags (or RINEX-2-style SNR flag
# values, disambiguated by field type below).
_FLOAT_RE = re.compile(r"[+-]?\d+\.?\d*(?:[eEdD][+-]?\d+)?")
_SAT_RE = re.compile(r"^[GRECJIS]\d{2}$")

# RINEX 2 epoch line: ' 24  1  1  0  0  0.0000000  0 20G02R11...'
_V2_EPOCH_RE = re.compile(
    r"^\s*(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})"
    r"\s+(\d+(?:\.\d+)?)\s+(\d)\s+(\d+)\s*(.*)$"
)
_V2_EPOCH_NOFLAG_RE = re.compile(
    r"^\s*(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})"
    r"\s+(\d+(?:\.\d+)?)\s+(\d+)\s*(.*)$"
)


class RinexObsError(ValueError):
    """Raised when an observation file cannot be parsed as RINEX at all."""


class ObsFile:
    """Parsed RINEX observation file (either version)."""

    def __init__(self) -> None:
        self.version: str = ""
        self.rinex_type: str = ""          # "O" for observation files
        self.marker_name: str = ""
        self.approx_position: Optional[tuple[float, float, float]] = None
        self.interval: Optional[float] = None
        # RINEX 3: system char -> list of 3-char obs codes ("C1C", "L1W")
        # RINEX 2: {"*": list of 2-char codes ("C1", "L1")}
        self.obs_types: dict[str, list[str]] = {}
        # epochs: list of {"time": datetime, "flag": int,
        #                  "sats": {sat: {obs_code: float}}}
        self.epochs: list[dict[str, Any]] = []
        self.header_warnings: list[str] = []

    @property
    def n_epochs(self) -> int:
        return len(self.epochs)


def _decompress_if_needed(content: bytes) -> bytes:
    """Transparently gunzip. Reject legacy .Z with an actionable message."""
    if content[:2] == b"\x1f\x8b":
        try:
            return gzip.decompress(content)
        except OSError as exc:
            raise RinexObsError(f"gzip decompression failed: {exc}") from exc
    if content[:2] == b"\x1f\x9d":
        raise RinexObsError(
            "Legacy UNIX-compress (.Z) files are not supported — "
            "please convert to plain or gzip first (e.g. `zcat file.Z | gzip`)."
        )
    return content


def _try_hatanaka(content: bytes) -> Optional[bytes]:
    """Run crx2rnx on Hatanaka-compressed content when the tool exists."""
    crx = shutil.which("crx2rnx")
    if not crx:
        return None
    try:
        proc = subprocess.run([crx, "-"], input=content,
                               capture_output=True, timeout=60)
        if proc.returncode == 0 and proc.stdout:
            return proc.stdout
    except (subprocess.SubprocessError, OSError):
        return None
    return None


def _looks_like_rinex_header(text: str) -> bool:
    head = text[:800]
    return "RINEX VERSION / TYPE" in head and "OBSERVATION DATA" in head


def _pad16(segment: str) -> str:
    """Pad a line segment to a whole number of 16-char observation slots."""
    n = len(segment)
    return segment + " " * (((n + 15) // 16) * 16 - n)


def _pad_line(segment: str, full_width: int) -> str:
    """Pad an observation line to a FULL slot row.

    Writers strip trailing blank slots from record lines (teqc does it on
    intermediate lines too — verified against real 1LSU data). Padding to
    the full row width (RINEX 2: 80 chars = 5 slots; RINEX 3: 64 = 4 slots
    after the 3-char ID) restores them; longer non-conforming lines
    (sbf2rin >80 chars) keep their length, rounded up to a whole slot.
    """
    n = len(segment)
    width = max(full_width, ((n + 15) // 16) * 16)
    return segment + " " * (width - n)


def _parse_slot_field(slot: str) -> Optional[float]:
    """Parse one 16-char observation slot → value (flags are discarded).

    Real-world encoders break the F14.3+LLI+SSI layout two ways: values
    longer than 14 chars eat the flag columns (Septentrio sbf2rin), and
    flags are often space-separated (teqc). Resolution order:
      1. whole slot parses as one float → value, no flags (long value)
      2. whitespace-split: leading float + 1-2 single digits → value
    Worst-case misparse (14-char value with directly-adjacent flags read
    as a longer value) shifts a code range by <1 mm — irrelevant for SPP.
    """
    stripped = slot.strip()
    if not stripped:
        return None
    m = _FLOAT_RE.match(stripped)
    if m and m.end() == len(stripped):
        try:
            return float(stripped.replace("D", "E").replace("d", "e"))
        except ValueError:
            return None
    parts = stripped.split()
    if parts:
        try:
            return float(parts[0].replace("D", "E").replace("d", "e"))
        except ValueError:
            return None
    return None


def _parse_obs_fields(text: str, n_expected: int) -> list[Optional[float]]:
    """Parse one satellite's observation text into n_expected values.

    Primary: the 16-char slot grid (satellite ID already removed) with
    blank-slot skipping. Fallback for grid-hostile files: tokenise values,
    dropping bare single digits that follow a value (they are LLI/SSI).
    """
    values: list[Optional[float]] = [None] * n_expected
    pos = 0
    idx = 0
    grid_ok = True
    while idx < n_expected and pos < len(text):
        slot = text[pos: pos + 16]
        if slot.strip() == "":
            if len(slot) < 16:
                break
            pos += 16
            idx += 1
            continue
        value = _parse_slot_field(slot)
        if value is None:
            grid_ok = False
            break
        values[idx] = value
        pos += 16
        idx += 1
    if grid_ok:
        return values

    out: list[Optional[float]] = [None] * n_expected
    j = 0
    prev_was_value = False
    for m in _FLOAT_RE.finditer(text):
        tok = m.group()
        if (prev_was_value and len(tok) == 1 and tok.isdigit()
                and "." not in tok):
            prev_was_value = False   # LLI/SSI flag of the previous value
            continue
        if j >= n_expected:
            break
        try:
            out[j] = float(tok.replace("D", "E").replace("d", "e"))
        except ValueError:
            continue
        j += 1
        prev_was_value = True
    return out


def parse_rinex_obs(content: bytes) -> ObsFile:
    """Parse a RINEX 2.x or 3.x observation file (bytes → ObsFile).

    Raises RinexObsError with an actionable message when the content is not
    a RINEX observation file. gzip input is transparently decompressed;
    Hatanaka input is decompressed via crx2rnx when installed (georinex
    ships it in the worker image).
    """
    if len(content) > MAX_INPUT_BYTES:
        raise RinexObsError(
            f"Observation file exceeds {MAX_INPUT_BYTES // (1024 * 1024)} MiB "
            "after decompression — split the session."
        )
    content = _decompress_if_needed(content)
    text = content.decode("ascii", errors="replace")

    if not _looks_like_rinex_header(text):
        hatanaka = _try_hatanaka(content)
        if hatanaka:
            text = hatanaka.decode("ascii", errors="replace")
            if not _looks_like_rinex_header(text):
                raise RinexObsError("crx2rnx output was not a RINEX observation file")
        else:
            raise RinexObsError(
                "Not a RINEX observation file (no 'RINEX VERSION / TYPE' "
                "header). Hatanaka-compressed files need crx2rnx, which is "
                "not installed in this worker."
            )

    first_line = text.split("\n", 1)[0]
    parts = first_line.split()
    version = parts[0] if parts else "?"
    if version.startswith("3"):
        return _parse_obs_v3(text)
    if version.startswith("2"):
        return _parse_obs_v2(text)
    raise RinexObsError(f"Unsupported RINEX version {version!r} (expected 2.x or 3.x)")


# ─── RINEX 3 observation parsing ────────────────────────────────────────────

def _parse_obs_v3(text: str) -> ObsFile:
    obs = ObsFile()
    obs.version = "3"
    lines = text.split("\n")
    n_lines = len(lines)

    i = 0
    while i < n_lines:
        line = lines[i]
        label = line[60:80].strip() if len(line) >= 60 else ""
        if label == "END OF HEADER":
            i += 1
            break
        if label == "RINEX VERSION / TYPE":
            obs.rinex_type = line[20:21]
            if obs.rinex_type != "O":
                raise RinexObsError(
                    f"Expected RINEX observation file, got type {obs.rinex_type!r}")
        elif label == "MARKER NAME":
            obs.marker_name = line[:60].strip()
        elif label == "APPROX POSITION XYZ":
            try:
                obs.approx_position = tuple(float(line[k:k + 14]) for k in (0, 14, 28))
            except ValueError:
                obs.header_warnings.append("Unparseable APPROX POSITION XYZ")
        elif label == "INTERVAL":
            try:
                obs.interval = float(line[:10])
            except ValueError:
                pass
        elif label == "SYS / # / OBS TYPES":
            system = line[0]
            try:
                count = int(line[3:6])
            except ValueError:
                count = 0
            codes = line[6:60].split()
            while len(codes) < count and i + 1 < n_lines:
                i += 1
                codes += lines[i][6:60].split()
            obs.obs_types[system] = codes[:count]
        i += 1
    else:
        raise RinexObsError("RINEX 3 header ended without END OF HEADER")

    current_time: Optional[datetime] = None
    current_flag = 0
    sat_obs: dict[str, dict[str, float]] = {}
    pending_header_lines = 0

    def flush_epoch() -> None:
        if current_time is not None and sat_obs:
            obs.epochs.append({"time": current_time, "flag": current_flag,
                                "sats": dict(sat_obs)})

    while i < n_lines:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith(">"):
            flush_epoch()
            sat_obs = {}
            try:
                current_time = datetime(int(line[2:6]), int(line[7:9]),
                                        int(line[10:12]), int(line[13:15]),
                                        int(line[16:18]))
                sec = float(line[19:29])
                current_time += timedelta(seconds=int(sec),
                                          microseconds=int(round((sec % 1) * 1e6)))
                current_flag = int(line[29:32]) if line[29:32].strip() else 0
                n_sats = int(line[32:35]) if line[32:35].strip() else 0
            except (ValueError, IndexError) as exc:
                raise RinexObsError(
                    f"Unparseable RINEX 3 epoch line: {line!r} ({exc})") from exc
            if current_flag == 4:          # header lines follow this epoch
                pending_header_lines = n_sats
            i += 1
            continue
        if pending_header_lines > 0:
            pending_header_lines -= 1
            i += 1
            continue
        if _SAT_RE.match(line[:3]):
            sat = line[0:3]
            codes = obs.obs_types.get(sat[0])
            if codes is None:
                i += 1
                continue
            # Observation record: sat ID + slots. Conforming lines wrap at
            # 80 chars (4 slots, 3 leading blanks on continuations), but
            # real encoders (sbf2rin) emit single >250-char lines — the
            # whole line is consumed either way.
            body = _pad_line(line[3:].rstrip(), 64)
            while i + 1 < n_lines:
                nxt = lines[i + 1]
                if (nxt.startswith(">") or nxt.strip() == ""
                        or not nxt.startswith(" ")):
                    break
                body += _pad_line(nxt[3:].rstrip(), 64)
                i += 1
            values = _parse_obs_fields(body, len(codes))
            sat_obs[sat] = {code: val for code, val in zip(codes, values)
                            if val is not None}
            i += 1
            continue
        i += 1

    flush_epoch()
    if not obs.epochs:
        raise RinexObsError("No observation epochs found in RINEX 3 file body")
    return obs


# ─── RINEX 2 observation parsing ────────────────────────────────────────────

def _split_sat_ids(text: str) -> list[str]:
    """Split a concatenated RINEX 2 satellite list ('G02R11G22…') into IDs."""
    text = text.strip()
    return [text[i:i + 3] for i in range(0, len(text), 3)]


def _is_satlist_line(line: str) -> bool:
    text = line.strip()
    if not text or len(text) % 3 != 0:
        return False
    return all(_SAT_RE.match(tok) for tok in _split_sat_ids(text))


def _parse_obs_v2(text: str) -> ObsFile:
    obs = ObsFile()
    obs.version = "2"
    lines = text.split("\n")
    n_lines = len(lines)

    types: list[str] = []
    i = 0
    while i < n_lines:
        line = lines[i]
        label = line[60:80].strip() if len(line) >= 60 else ""
        if label == "END OF HEADER":
            i += 1
            break
        if label == "RINEX VERSION / TYPE":
            obs.rinex_type = line[20:21]
            if obs.rinex_type != "O":
                raise RinexObsError(
                    f"Expected RINEX observation file, got type {obs.rinex_type!r}")
        elif label == "MARKER NAME":
            obs.marker_name = line[:60].strip()
        elif label == "APPROX POSITION XYZ":
            try:
                obs.approx_position = tuple(float(line[k:k + 14]) for k in (0, 14, 28))
            except ValueError:
                obs.header_warnings.append("Unparseable APPROX POSITION XYZ")
        elif label == "INTERVAL":
            try:
                obs.interval = float(line[:10])
            except ValueError:
                pass
        elif label == "# / TYPES OF OBSERV":
            try:
                count = int(line[0:6])
            except ValueError:
                count = 0
            types += line[6:60].split()
            while len(types) < count and i + 1 < n_lines:
                i += 1
                types += lines[i][6:60].split()
            types = types[:count]
        i += 1
    else:
        raise RinexObsError("RINEX 2 header ended without END OF HEADER")

    if not types:
        raise RinexObsError("RINEX 2 header has no '# / TYPES OF OBSERV'")

    obs.obs_types["*"] = types
    n_fields = len(types)
    lines_per_sat = max(1, math.ceil(n_fields / 5))

    current_time: Optional[datetime] = None
    current_flag = 0
    sat_obs: dict[str, dict[str, float]] = {}

    def flush_epoch() -> None:
        if current_time is not None and sat_obs:
            obs.epochs.append({"time": current_time, "flag": current_flag,
                                "sats": dict(sat_obs)})

    while i < n_lines:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        m = _V2_EPOCH_RE.match(line) or _V2_EPOCH_NOFLAG_RE.match(line)
        if m:
            g = m.groups()
            if len(g) == 9:
                yy, mm, dd, hh, mi, ss, flag, n_sat, rest = g
            else:
                yy, mm, dd, hh, mi, ss, n_sat, rest = g
                flag = "0"
            flush_epoch()
            sat_obs = {}
            try:
                year = 2000 + int(yy) if int(yy) < 80 else 1900 + int(yy)
                sec = float(ss)
                current_time = datetime(year, int(mm), int(dd), int(hh), int(mi),
                                        int(sec),
                                        int(round((sec % 1) * 1e6)))
            except ValueError as exc:
                raise RinexObsError(
                    f"Unparseable RINEX 2 epoch line: {line!r} ({exc})") from exc
            current_flag = int(flag)
            i += 1
            if current_flag not in (0, 1):
                # event epoch: header lines or skipped observations follow
                skip = int(n_sat) if current_flag >= 2 else 0
                for _ in range(skip):
                    if i < n_lines:
                        i += 1
                continue
            sat_ids = _split_sat_ids(rest)
            while len(sat_ids) < int(n_sat) and i < n_lines:
                if _is_satlist_line(lines[i]):
                    sat_ids += _split_sat_ids(lines[i])
                    i += 1
                else:
                    break
            # one observation record per satellite, lines_per_sat lines each
            for sat in sat_ids:
                body = ""
                got = 0
                while got < lines_per_sat and i < n_lines:
                    ln = lines[i]
                    if (got > 0 and (_V2_EPOCH_RE.match(ln)
                                    or _V2_EPOCH_NOFLAG_RE.match(ln)
                                    or _is_satlist_line(ln))):
                        break   # writer omitted trailing blank obs lines
                    if ln.strip() == "":
                        body += " " * 80
                    else:
                        body += _pad_line(ln[:80].rstrip(), 80)
                    i += 1
                    got += 1
                if got == 0:
                    break
                values = _parse_obs_fields(body, n_fields)
                sat_obs[sat] = {code: val for code, val in zip(types, values)
                                if val is not None}
            continue
        i += 1

    flush_epoch()
    if not obs.epochs:
        raise RinexObsError("No observation epochs found in RINEX 2 file body")
    return obs

# ═══════════════════════════════════════════════════════════════════════════
# RINEX NAVIGATION PARSING (broadcast ephemeris — GPS + Galileo)
# ═══════════════════════════════════════════════════════════════════════════


class Ephemeris:
    """One broadcast ephemeris record (Keplerian, GPS or Galileo)."""

    __slots__ = (
        "sat", "system", "toc", "toe", "week", "af0", "af1", "af2",
        "sqrt_a", "e", "m0", "dn", "omega", "omega0", "i0", "idot",
        "omega_dot", "cuc", "cus", "crc", "crs", "cic", "cis",
        "tgd", "iode", "iodc", "fit_hours", "accuracy_m", "healthy",
    )

    def __init__(self, sat: str, system: str) -> None:
        self.sat = sat
        self.system = system
        self.toc: Optional[datetime] = None
        self.toe = 0.0
        self.week = 0
        self.af0 = self.af1 = self.af2 = 0.0
        self.sqrt_a = 0.0
        self.e = 0.0
        self.m0 = 0.0
        self.dn = 0.0
        self.omega = 0.0
        self.omega0 = 0.0
        self.i0 = 0.0
        self.idot = 0.0
        self.omega_dot = 0.0
        self.cuc = self.cus = 0.0
        self.crc = self.crs = 0.0
        self.cic = self.cis = 0.0
        self.tgd = 0.0
        self.iode = 0
        self.iodc = 0
        self.fit_hours = 4.0
        self.accuracy_m = 0.0
        self.healthy = True

    @property
    def mu(self) -> float:
        return MU_GPS if self.system == "G" else MU_GALILEO


class NavFile:
    """Parsed broadcast navigation file."""

    def __init__(self) -> None:
        self.version = ""
        self.ephemerides: dict[str, list[Ephemeris]] = {}
        self.ion_alpha: Optional[list[float]] = None   # Klobuchar (GPS)
        self.ion_beta: Optional[list[float]] = None
        self.warnings: list[str] = []

    def select(self, sat: str, t_abs_gps: float) -> Optional[Ephemeris]:
        """Best ephemeris for `sat` at absolute GPS seconds (closest toe)."""
        records = self.ephemerides.get(sat)
        if not records:
            return None
        best = None
        best_age = None
        for eph in records:
            eph_toc = gps_seconds(eph.toc) if eph.toc else 0.0
            age = abs(t_abs_gps - eph_toc)
            if best_age is None or age < best_age:
                best, best_age = eph, age
        if best is not None and best_age is not None \
                and best_age > BROADCAST_EPH_MAX_AGE:
            return None    # too far from toe — fit interval exceeded
        return best


# Nav body lines (2-8) carry four F19.12 fields. Generators right-justify
# the 18-char scientific values so fields END at columns 23/42/61/80 (i.e.
# slices [4:23],[23:42],[42:61],[61:80] — verified against BKG BRDC00WRD);
# a minority of files use plain [0:19],[19:38],[38:57],[57:76]. Fields glue
# together without separators, so column slicing is mandatory — both schemes
# are tried, first one where all present fields parse wins.
_NAV_SCHEMES = ((4, 23, 42, 61), (0, 19, 38, 57))


def _nav_line_values(line: str) -> list[Optional[float]]:
    """Parse one nav body line into its 4 field values (scheme-consistent).

    A single scheme must hold for the whole line — mixing per-field schemes
    could tear glued values apart. Blank fields → None.
    """
    for offsets in _NAV_SCHEMES:
        vals: list[Optional[float]] = []
        ok = True
        for start in offsets:
            text = line[start:start + 19].strip()
            if not text:
                vals.append(None)
                continue
            try:
                vals.append(float(text.replace("D", "E").replace("d", "e")))
            except ValueError:
                ok = False
                break
        if ok:
            return vals
    return [None, None, None, None]


def _nav_f19(line: str, k: int) -> float:
    """k-th field (0-based) of a nav body line, 0.0 when blank/unparseable."""
    val = _nav_line_values(line)[k]
    return val if val is not None else 0.0


# RINEX 2 nav line 1 tolerates column variants across generators; the only
# real hazard is the glued 'seconds+af0' boundary ('44.0-4.246e-04'), which
# this anchored regex splits correctly.
_V2_NAV_L1_RE = re.compile(
    r"^\s*(\d+)\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})"
    r"\s+(\d+(?:\.\d*)?)\s*"
    r"([+-]?\d+(?:\.\d*)?(?:[eEdD][+-]?\d+)?)\s*"
    r"([+-]?\d+(?:\.\d*)?(?:[eEdD][+-]?\d+)?)\s*"
    r"([+-]?\d+(?:\.\d*)?(?:[eEdD][+-]?\d+)?)"
)


def parse_rinex_nav(content: bytes) -> NavFile:
    """Parse a RINEX 2 or 3 navigation file (GPS + Galileo Keplerian records).

    GLONASS and BeiDou records are skipped with a warning: GLONASS broadcasts
    state vectors on a UTC time scale, BeiDou runs BDT (GPST-14 s) — both
    need dedicated models that this module does not fake.
    """
    if content[:2] == b"\x1f\x8b":
        try:
            content = gzip.decompress(content)
        except OSError as exc:
            raise ValueError(f"gzip decompression of nav file failed: {exc}") from exc
    text = content.decode("ascii", errors="replace")
    lines = text.split("\n")

    nav = NavFile()
    first = lines[0].split()
    nav.version = first[0] if first else "?"
    if not nav.version.startswith(("2", "3")):
        raise ValueError(f"Unsupported RINEX nav version {nav.version!r}")
    is_v3 = nav.version.startswith("3")

    i = 0
    n_lines = len(lines)
    header = True
    while header and i < n_lines:
        line = lines[i]
        label = line[60:80].strip() if len(line) >= 60 else ""
        if label == "END OF HEADER":
            header = False
        elif label in ("ION ALPHA", "GPSA") and nav.ion_alpha is None:
            try:
                nav.ion_alpha = [float(line[k:k + 12]) for k in (2, 14, 26, 38)
                                 if line[k:k + 12].strip()]
            except ValueError:
                pass
        elif label in ("ION BETA", "GPSB") and nav.ion_beta is None:
            try:
                nav.ion_beta = [float(line[k:k + 12]) for k in (2, 14, 26, 38)
                                if line[k:k + 12].strip()]
            except ValueError:
                pass
        i += 1

    seen_systems: set[str] = set()
    while i < n_lines:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if is_v3:
            sat = line[0:3].strip()
            system = sat[0] if len(sat) == 3 else ""
            ok_sat = len(sat) == 3 and _SAT_RE.match(sat) is not None
        else:
            m_l1 = _V2_NAV_L1_RE.match(line)
            sat = f"G{int(m_l1.group(1)):02d}" if m_l1 else ""
            system = "G"
            ok_sat = m_l1 is not None
        if not ok_sat:
            i += 1
            continue
        # Record length: GLONASS/SBAS broadcast state vectors in 4 lines;
        # Keplerian systems (G/E/C/J/I) use 8. Walking with the wrong
        # length misaligns every record after the first short one.
        rec_len = 4 if system in ("R", "S") else 8
        record = lines[i: i + rec_len]
        if len(record) < rec_len:
            break
        if system not in ("G", "E"):
            if system not in seen_systems:
                seen_systems.add(system)
                which = {"R": "GLONASS", "C": "BeiDou", "J": "QZSS",
                         "I": "NavIC/IRNSS", "S": "SBAS"}.get(system, system)
                nav.warnings.append(
                    f"{which} satellites present but skipped — only GPS and "
                    "Galileo broadcast ephemerides are processed "
                    "(time-system models for others are not implemented).")
            i += rec_len
            continue
        try:
            eph = _parse_nav_record(record, sat, system, is_v3)
        except (ValueError, IndexError) as exc:
            nav.warnings.append(f"Skipping unparseable ephemeris for {sat}: {exc}")
            i += rec_len
            continue
        nav.ephemerides.setdefault(sat, []).append(eph)
        i += rec_len
    return nav


def _parse_nav_record(record: list[str], sat: str, system: str,
                      is_v3: bool) -> Ephemeris:
    eph = Ephemeris(sat, system)
    head = record[0]

    def _f(tok: str) -> float:
        return float(tok.replace("D", "E").replace("d", "e"))

    if is_v3:
        # 'G01 2024 01 01 00 00 00' + af0/af1/af2 at [23:42],[42:61],[61:80]
        year = int(head[4:8])
        mm, dd = int(head[9:11]), int(head[12:14])
        hh, mi = int(head[15:17]), int(head[18:20])
        ss = int(head[21:23])
        eph.af0, eph.af1, eph.af2 = (_f(head[k:k + 19].strip()) for k in (23, 42, 61))
    else:
        m = _V2_NAV_L1_RE.match(head)
        if not m:
            raise ValueError("unparseable RINEX 2 nav clock line")
        yy, mm, dd, hh, mi, ss = (int(m.group(k)) for k in range(2, 8))
        year = 2000 + yy if yy < 80 else 1900 + yy
        eph.af0, eph.af1, eph.af2 = (_f(m.group(k)) for k in (8, 9, 10))
    eph.toc = datetime(year, mm, dd, hh, mi, ss)

    _fill_keplerian(eph, record)
    return eph


def _fill_keplerian(eph: Ephemeris, record: list[str]) -> None:
    """Fill Keplerian elements from nav body lines 2-8 (RINEX 2 and 3 share
    the field order; only the trailing metadata differs)."""
    f = _nav_f19
    r = record
    eph.iode = int(f(r[1], 0))
    eph.crs = f(r[1], 1)
    eph.dn = f(r[1], 2)
    eph.m0 = f(r[1], 3)

    eph.cuc = f(r[2], 0)
    eph.e = f(r[2], 1)
    eph.cus = f(r[2], 2)
    eph.sqrt_a = f(r[2], 3)

    eph.toe = f(r[3], 0)
    eph.cic = f(r[3], 1)
    eph.omega0 = f(r[3], 2)
    eph.cis = f(r[3], 3)

    eph.i0 = f(r[4], 0)
    eph.crc = f(r[4], 1)
    eph.omega = f(r[4], 2)
    eph.omega_dot = f(r[4], 3)

    eph.idot = f(r[5], 0)
    eph.week = int(f(r[5], 2))
    eph.tgd = f(r[6], 2)
    if eph.system == "G":
        eph.iodc = int(f(r[6], 3))
        eph.accuracy_m = abs(f(r[7], 0))
    fit = f(r[7], 1) if len(r) > 7 else 0.0
    if fit > 0:
        eph.fit_hours = fit


# ═══════════════════════════════════════════════════════════════════════════
# SATELLITE POSITION / CLOCK (broadcast ephemeris)
# ═══════════════════════════════════════════════════════════════════════════


class SatClockError(ValueError):
    pass


def sat_pos_clock_broadcast(eph: Ephemeris, t_abs_gps: float) -> dict[str, float]:
    """IS-GPS-200 / Galileo OSS-ICD satellite state at absolute GPS seconds.

    Returns dict with x/y/z (m, ECEF at transmission time), clock (s, the
    IF-referenced SV clock bias incl. relativistic term), and eccentric
    anomaly for tests. Raises SatClockError for degenerate ephemerides.
    """
    # time from ephemeris/clock reference epoch, in seconds of week
    toc_sow = gps_week_and_sow(eph.toc)[1] if eph.toc else 0.0
    t_sow = t_abs_gps % GPS_WEEK_SECONDS
    dt_clock = t_sow - toc_sow
    if dt_clock > GPS_WEEK_SECONDS / 2:
        dt_clock -= GPS_WEEK_SECONDS
    elif dt_clock < -GPS_WEEK_SECONDS / 2:
        dt_clock += GPS_WEEK_SECONDS

    a = eph.sqrt_a * eph.sqrt_a
    if a <= 0.0 or eph.sqrt_a <= 0.0:
        raise SatClockError(f"Degenerate semi-major axis for {eph.sat}")
    n0 = math.sqrt(eph.mu / (a * a * a))
    n = n0 + eph.dn

    tk = t_sow - eph.toe
    if tk > GPS_WEEK_SECONDS / 2:
        tk -= GPS_WEEK_SECONDS
    elif tk < -GPS_WEEK_SECONDS / 2:
        tk += GPS_WEEK_SECONDS

    mk = eph.m0 + n * tk
    e = eph.e
    if not (0.0 <= e < 0.9):
        raise SatClockError(f"Impossible eccentricity {e} for {eph.sat}")

    # Kepler: E - e·sinE = M (Newton-Raphson)
    ek = mk
    for _ in range(KEPLER_MAX_ITER):
        sec = 1.0 - e * math.cos(ek)
        d = (ek - e * math.sin(ek) - mk) / sec if sec != 0 else 0.0
        ek -= d
        if abs(d) < KEPLER_TOL:
            break
    else:
        raise SatClockError(f"Kepler solver did not converge for {eph.sat}")

    sin_e, cos_e = math.sin(ek), math.cos(ek)
    vk = math.atan2(math.sqrt(1.0 - e * e) * sin_e, cos_e - e)
    phik = vk + eph.omega

    sin2p, cos2p = math.sin(2.0 * phik), math.cos(2.0 * phik)
    du = eph.cus * sin2p + eph.cuc * cos2p
    dr = eph.crs * sin2p + eph.crc * cos2p
    di = eph.cis * sin2p + eph.cic * cos2p

    uk = phik + du
    rk = a * (1.0 - e * cos_e) + dr
    ik = eph.i0 + di + eph.idot * tk

    xp = rk * math.cos(uk)
    yp = rk * math.sin(uk)

    omega_k = eph.omega0 + (eph.omega_dot - GPS_OMEGA_E) * tk \
        - GPS_OMEGA_E * eph.toe
    sin_ok, cos_ok = math.sin(omega_k), math.cos(omega_k)
    sin_ik, cos_ik = math.sin(ik), math.cos(ik)

    x = xp * cos_ok - yp * cos_ik * sin_ok
    y = xp * sin_ok + yp * cos_ik * cos_ok
    z = yp * sin_ik

    # SV clock (IF-referenced) + relativistic eccentricity correction
    f_rel = F_REL_GPS if eph.system == "G" else F_REL_GAL
    clock = (eph.af0 + eph.af1 * dt_clock + eph.af2 * dt_clock * dt_clock
             + f_rel * eph.e * eph.sqrt_a * sin_e)

    return {"x": x, "y": y, "z": z, "clock": clock, "ek": ek}


def sagnac_rotate(x: float, y: float, z: float,
                  travel_seconds: float) -> tuple[float, float, float]:
    """Rotate a satellite ECEF position (transmission frame) into the
    reception frame: R3(ω·τ) applied about the Z axis."""
    theta = GPS_OMEGA_E * travel_seconds
    c, s = math.cos(theta), math.sin(theta)
    return (x * c + y * s, -x * s + y * c, z)


# ═══════════════════════════════════════════════════════════════════════════
# SP3 PRECISE EPHEMERIS
# ═══════════════════════════════════════════════════════════════════════════


class Sp3File:
    """Parsed SP3(c) precise ephemeris: orbits (m) + clocks (s) per satellite,
    stored at absolute GPS seconds."""

    def __init__(self) -> None:
        self.times: list[float] = []
        self.positions: dict[str, list[tuple[float, float, float]]] = {}
        self.clocks: dict[str, list[float]] = {}
        self.label = ""
        self.interval = 900.0
        self.warnings: list[str] = []

    @property
    def t_start(self) -> Optional[float]:
        return self.times[0] if self.times else None

    @property
    def t_end(self) -> Optional[float]:
        return self.times[-1] if self.times else None

    def sat_position_clock(self, sat: str, t_abs_gps: float
                           ) -> Optional[dict[str, float]]:
        """Lagrange-interpolated position (m) and clock (s) at t.

        Interpolation is 8th order over a centred 9-point window (standard
        for 15-minute SP3). Extrapolation is limited to a 10-second margin
        beyond the file's first/last epoch — signal transmission times
        precede reception by <0.1 s, so a session starting exactly at the
        first SP3 epoch still resolves; the polynomial error over 0.1 s
        with 900 s nodes is sub-millimetre. Beyond the margin: None
        (honest failure, never a made-up position).
        """
        times = self.times
        if not times or sat not in self.positions:
            return None
        margin = 10.0
        if (t_abs_gps < times[0] - margin
                or t_abs_gps > times[-1] + margin):
            return None
        t_clamped = min(max(t_abs_gps, times[0]), times[-1])
        n = len(times)
        order = min(9, n)
        # centred window
        idx = min(range(n), key=lambda k: abs(times[k] - t_clamped))
        lo = max(0, min(idx - order // 2, n - order))
        hi = lo + order
        xs = times[lo:hi]

        def lagrange(vals: list[float]) -> float:
            acc = 0.0
            for j in range(order):
                if vals[j] is None:
                    return float("nan")
                term = vals[j]
                for m in range(order):
                    if m != j:
                        denom = xs[j] - xs[m]
                        if denom == 0.0:
                            return float("nan")
                        term *= (t_abs_gps - xs[m]) / denom
                acc += term
            return acc

        px, py, pz = (lagrange([p[k] for p in self.positions[sat][lo:hi]])
                      for k in range(3))
        if not all(map(math.isfinite, (px, py, pz))):
            return None
        result = {"x": px, "y": py, "z": pz, "clock": float("nan")}
        if sat in self.clocks:
            clk = lagrange(self.clocks[sat][lo:hi])
            if math.isfinite(clk):
                result["clock"] = clk
        return result


def parse_sp3(content: bytes) -> Sp3File:
    """Parse an SP3c precise ephemeris file (positions km → m, clocks µs → s).

    Clock records of 999999.999999 (or blank) mean "no clock" and are
    recorded as NaN — callers must handle mixed availability honestly.
    """
    if content[:2] == b"\x1f\x8b":
        content = gzip.decompress(content)
    text = content.decode("ascii", errors="replace")
    lines = text.split("\n")

    sp3 = Sp3File()
    if not lines or not lines[0].startswith("#"):
        raise ValueError("Not an SP3 file (missing '#' first header line)")

    # header: '#cP2024  1  1  0  0  0.00000000      96 ORBIT IGS20 HLM  IGS'
    head = lines[0]
    try:
        year = int(head[3:7])
        month = int(head[8:10])
        day = int(head[11:13])
        hour = int(head[14:16])
        minute = int(head[17:19])
        second = float(head[20:31])
        sp3.label = head[32:39].strip()
        t0 = datetime(year, month, day, hour, minute,
                      int(second), int(round((second % 1) * 1e6)))
    except (ValueError, IndexError) as exc:
        raise ValueError(f"Unparseable SP3 header: {exc}") from exc

    try:
        sp3.interval = float(lines[1][24:39])
    except (ValueError, IndexError):
        sp3.interval = 900.0

    current_t = 0.0
    have_current = False
    for line in lines[1:]:
        if line.startswith("*"):
            # '*  YYYY MM DD HH MM SS.SSSSSSSS' — fields right-justified in
            # 2-char slots at [8:10],[11:13],[14:16],[17:19], seconds [20:31]
            try:
                year = int(line[3:7])
                month = int(line[8:10])
                day = int(line[11:13])
                hour = int(line[14:16])
                minute = int(line[17:19])
                second = float(line[20:31])
                dt = datetime(year, month, day, hour, minute,
                              int(second), int(round((second % 1) * 1e6)))
                current_t = gps_seconds(dt)
                have_current = True
                if sp3.times and current_t <= sp3.times[-1]:
                    have_current = False   # duplicate/unordered epoch — skip
                else:
                    sp3.times.append(current_t)
            except (ValueError, IndexError):
                have_current = False
            continue
        if not have_current or len(line) < 46:
            continue
        if line[0] == "P":               # position record: P G01 x y z clk
            sat = line[1:4]
            if sat[0] not in SUPPORTED_SYSTEMS:
                continue
            try:
                x = float(line[4:18]) * 1000.0
                y = float(line[18:32]) * 1000.0
                z = float(line[32:46]) * 1000.0
            except ValueError:
                continue
            clock = float("nan")
            if len(line) >= 60:
                raw = line[46:60].strip()
                if raw and not raw.startswith("999999"):
                    try:
                        clock = float(raw) * 1e-6
                    except ValueError:
                        pass
            slot = len(sp3.times) - 1
            pos_list = sp3.positions.setdefault(sat, [])
            clk_list = sp3.clocks.setdefault(sat, [])
            while len(pos_list) <= slot:
                pos_list.append((float("nan"),) * 3)
                clk_list.append(float("nan"))
            pos_list[slot] = (x, y, z)
            clk_list[slot] = clock
    if not sp3.times:
        raise ValueError("SP3 file contains no epochs")
    # trim padding rows (trailing empty epochs)
    n = len(sp3.times)
    for sat in list(sp3.positions):
        sp3.positions[sat] = sp3.positions[sat][:n]
        sp3.clocks[sat] = sp3.clocks[sat][:n]
    # satellites with all-NaN clocks → drop clock entries
    for sat in list(sp3.clocks):
        if all(math.isnan(c) for c in sp3.clocks[sat]):
            del sp3.clocks[sat]
            sp3.warnings.append(f"SP3 carries no clocks for {sat}")
    del t0
    return sp3

# ═══════════════════════════════════════════════════════════════════════════
# EPHEMERIS ACQUISITION (anonymous public mirrors, in-process cache)
# ═══════════════════════════════════════════════════════════════════════════

_EPHEM_CACHE: dict[str, tuple[float, Any]] = {}


def _cache_get(key: str) -> Any:
    import time as _time
    hit = _EPHEM_CACHE.get(key)
    if hit and hit[0] > _time.time():
        return hit[1]
    return None


def _cache_set(key: str, value: Any) -> None:
    import time as _time
    if len(_EPHEM_CACHE) > 32:      # bounded cache
        _EPHEM_CACHE.clear()
    _EPHEM_CACHE[key] = (_time.time() + EPHEM_CACHE_TTL, value)


def _http_get(url: str) -> Optional[bytes]:
    if not HAS_REQUESTS:
        return None
    try:
        resp = requests.get(
            url, timeout=DOWNLOAD_TIMEOUT,
            headers={"User-Agent": "metardu-worker/1.0 (GNSS SPP)"})
        if resp.status_code == 200 and resp.content:
            return resp.content
    except requests.RequestException:
        return None
    return None


def fetch_brdc_nav(dt: datetime) -> Optional[NavFile]:
    """Download the consolidated daily broadcast nav file for `dt`'s date.

    Source: BKG's anonymous IGS mirror (BRDC00WRD, multi-GNSS). Returns
    None on any failure — callers must surface an honest error, never a
    substitute. Previous/next day fallback covers GPS-midnight windows.
    """
    key = f"brdc:{dt.strftime('%Y-%j')}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    candidates = [dt, dt - timedelta(days=1), dt + timedelta(days=1)]
    for cand in candidates:
        content = _http_get(BRDC_URL.format(
            year=cand.year, doy=int(cand.strftime("%j"))))
        if content is None:
            continue
        try:
            nav = parse_rinex_nav(content)
        except ValueError:
            continue
        if nav.ephemerides:
            _cache_set(key, nav)
            return nav
    return None


def fetch_sp3(dt: datetime) -> Optional[tuple[Sp3File, str]]:
    """Download an IGS SP3 precise ephemeris for `dt`'s date.

    Tries final → rapid → ultra-rapid (4 issue times) on the NOAA CORS
    mirror. Final products need ~13 days latency; recent days fall back
    automatically. Returns (Sp3File, product label) or None.
    """
    year, doy = dt.year, int(dt.strftime("%j"))
    for label, pattern in SP3_PRODUCTS:
        key = f"sp3:{label}:{dt.strftime('%Y-%j')}"
        cached = _cache_get(key)
        if cached is not None:
            return cached
        name = pattern.format(y=f"{year:04d}", d=f"{doy:03d}")
        content = _http_get(NOAA_SP3_URL.format(year=year, doy=doy, name=name))
        if content is None:
            continue
        try:
            sp3 = parse_sp3(content)
        except ValueError:
            continue
        if sp3.positions:
            value = (sp3, label)
            _cache_set(key, value)
            return value
    return None


# ═══════════════════════════════════════════════════════════════════════════
# OBSERVATION SELECTION (code ranges per satellite)
# ═══════════════════════════════════════════════════════════════════════════


class UsableObs:
    """A satellite's selected code-range observation for one epoch."""

    __slots__ = ("sat", "system", "pr", "mode", "band1", "band2")

    def __init__(self, sat: str, pr: float, mode: str,
                 band1: int, band2: Optional[int] = None) -> None:
        self.sat = sat
        self.system = sat[0]
        self.pr = pr
        self.mode = mode            # "L1" (single-frequency) or "IF"
        self.band1 = band1
        self.band2 = band2


def _pick_code(obs: dict[str, float],
               candidates: list[str]) -> Optional[tuple[str, float]]:
    for code in candidates:
        v = obs.get(code)
        if v is not None and 1.0e7 < v < 6.0e7:
            return code, v
    return None


def select_observations(sats: dict[str, dict[str, float]]) -> list[UsableObs]:
    """Choose the best code-range observation per satellite.

    Dual-frequency ionosphere-free (IF) is preferred (ionosphere is then
    eliminated by the combination itself); single-frequency otherwise
    (Klobuchar ionosphere applied by the solver when available). GPS
    band-2 preference: P2 → C2 → L5. Galileo: E5a → E5b.
    """
    chosen: list[UsableObs] = []
    for sat in sorted(sats):
        obs = sats[sat]
        system = sat[0]
        if system == "G":
            b1 = _pick_code(obs, ["C1C", "C1W", "C1X", "C1P", "P1", "C1"])
            b2 = _pick_code(obs, ["C2W", "C2", "P2", "C2L", "C2S",
                                  "C5", "C5Q", "C5X"])
        elif system == "E":
            b1 = _pick_code(obs, ["C1C", "C1X", "C1B"])
            b2 = _pick_code(obs, ["C5X", "C5Q", "C5I", "C7X", "C7Q", "C7I"])
        else:
            continue
        if b1 is None:
            continue
        if b2 is not None:
            band1, band2 = int(b1[0][1]), int(b2[0][1])
            f1 = FREQ.get((system, band1))
            f2 = FREQ.get((system, band2))
            if f1 and f2 and f1 != f2:
                # P_IF = (f1²·P1 − f2²·P2)/(f1² − f2²)
                pr_if = (f1 * f1 * b1[1] - f2 * f2 * b2[1]) / (f1 * f1 - f2 * f2)
                chosen.append(UsableObs(sat, pr_if, "IF", band1, band2))
                continue
        chosen.append(UsableObs(sat, b1[1], "L1", int(b1[0][1])))
    return chosen


# ═══════════════════════════════════════════════════════════════════════════
# EPHEMERIS ACCESS LAYER (broadcast or SP3, transmission-time refinement)
# ═══════════════════════════════════════════════════════════════════════════


class EphemerisSource:
    """Uniform satellite state access for broadcast or SP3 ephemerides."""

    def __init__(self, nav: Optional[NavFile], sp3: Optional[Sp3File],
                 strict_sp3: bool = True) -> None:
        self.nav = nav
        self.sp3 = sp3
        self.strict_sp3 = strict_sp3
        self.mixed_clock_sats: set[str] = set()

    @property
    def kind(self) -> str:
        return "sp3" if self.sp3 is not None else "broadcast"

    def _raw_state(self, sat: str, t_tx_abs: float) -> Optional[dict[str, float]]:
        """Position (ECEF, transmission frame) + clock at absolute GPS sec."""
        if self.sp3 is not None:
            st = self.sp3.sat_position_clock(sat, t_tx_abs)
            if st is not None and not math.isnan(st["clock"]):
                return st
            # SP3 lacks this satellite (or its clocks): if a nav file was
            # also supplied we may NOT silently mix orbit/clock products —
            # the biases would be invisible but meter-level. Skip instead.
            return None
        if self.nav is not None:
            eph = self.nav.select(sat, t_tx_abs)
            if eph is None:
                return None
            try:
                return sat_pos_clock_broadcast(eph, t_tx_abs)
            except SatClockError:
                return None
        return None

    def sat_state(self, sat: str, t_rx_abs: float, pr: float,
                  dt_rx: float) -> Optional[dict[str, float]]:
        """Satellite ECEF position in the RECEPTION frame + clock bias.

        Solves the transmission time t_tx = t_rx − pr/c + dt_rx − dt_sat
        iteratively (2 refinements), then applies the Sagnac rotation
        R3(ω·τ) with τ = t_rx − t_tx.
        """
        t_tx = t_rx_abs - pr / SPEED_OF_LIGHT + dt_rx
        st = None
        for _ in range(3):
            st = self._raw_state(sat, t_tx)
            if st is None:
                return None
            t_tx_new = t_rx_abs - pr / SPEED_OF_LIGHT + dt_rx - st["clock"]
            if abs(t_tx_new - t_tx) < 1e-9:
                t_tx = t_tx_new
                break
            t_tx = t_tx_new
        st = self._raw_state(sat, t_tx)
        if st is None:
            return None
        travel = t_rx_abs - t_tx
        rx, ry, rz = sagnac_rotate(st["x"], st["y"], st["z"], travel)
        return {"x": rx, "y": ry, "z": rz, "clock": st["clock"]}

    def group_delay(self, sat: str, mode: str, band1: int) -> float:
        """TGD/BGD correction (s) for single-frequency observations.

        Broadcast and SP3 clocks are referenced to the ionosphere-free
        combination; single-frequency users apply the broadcast group
        delay: dt_L1 = −TGD·f2²/(f1²−f2²). Returns 0 in IF mode.
        """
        if mode == "IF" or self.nav is None:
            return 0.0
        records = self.nav.ephemerides.get(sat)
        if not records:
            return 0.0
        tgd = records[-1].tgd
        system = sat[0]
        band2 = 2 if system == "G" else 5
        f1 = FREQ.get((system, band1))
        f2 = FREQ.get((system, band2))
        if not f1 or not f2 or f1 == f2:
            return 0.0
        return -tgd * f2 * f2 / (f1 * f1 - f2 * f2)


SIGMA_BASE_M = 0.6      # a-priori code noise at zenith (m)
SIGMA_SLOPE_M = 1.0     # elevation-dependent term (m)


def _observation_sigma(elev_deg: float) -> float:
    s = math.sin(max(5.0, elev_deg) * math.pi / 180.0)
    return math.sqrt(SIGMA_BASE_M ** 2 + (SIGMA_SLOPE_M / s) ** 2)


def bancroft_solution(states: list[dict[str, float]],
                      prs: list[float]) -> Optional[tuple[float, float, float, float]]:
    """Closed-form GPS point solution (Bancroft 1985) — cold-start seed.

    Solves the pseudorange equations algebraically via the Lorentz inner
    product, giving (x, y, z, c·dt_rx) without any initial position. Used
    to initialise the iterative WLS when no receiver position hint exists
    (no RINEX header position, first epoch). Returns None when degenerate.

    Derivation: for satellite position s_i, sat-clock-corrected range ρ_i,
    unknown x = (r, ct): ||s_i − r||² = (ρ_i − ct)² leads with
    λ = ⟨x,x⟩_M to the linear family x(λ) = M·pinv(A)·(b + λ/2·1) and a
    quadratic in λ; the root nearer the Earth's surface wins.
    """
    n = len(prs)
    if n < 4:
        return None
    A = np.zeros((n, 4))
    b = np.zeros(n)
    for i, (st, pr) in enumerate(zip(states, prs)):
        s = (st["x"], st["y"], st["z"])
        A[i, 0:3] = s
        A[i, 3] = pr
        b[i] = (s[0] ** 2 + s[1] ** 2 + s[2] ** 2 - pr ** 2) / 2.0
    try:
        u0, *_ = np.linalg.lstsq(A, b, rcond=None)
        u1, *_ = np.linalg.lstsq(A, np.ones(n), rcond=None)
    except np.linalg.LinAlgError:
        return None
    m = np.diag([1.0, 1.0, 1.0, -1.0])

    def lorentz(u: np.ndarray, v: np.ndarray) -> float:
        return float(u @ m @ v)

    a11 = lorentz(u1, u1) / 4.0
    a10 = lorentz(u0, u1) - 1.0
    a00 = lorentz(u0, u0)
    if abs(a11) < 1e-12:
        roots = [-a00 / a10] if abs(a10) > 1e-12 else []
    else:
        disc = a10 * a10 - 4.0 * a11 * a00
        if disc < 0:
            return None
        sq = math.sqrt(disc)
        roots = [(-a10 + sq) / (2.0 * a11), (-a10 - sq) / (2.0 * a11)]
    best = None
    for lam in roots:
        u = u0 + (lam / 2.0) * u1
        x = m @ u
        radius = float(np.linalg.norm(x[:3]))
        if not (5.0e6 < radius < 8.0e6):
            continue
        if best is None or abs(radius - 6.371e6) < abs(best[0] - 6.371e6):
            best = (radius, x)
    if best is None:
        return None
    x = best[1]
    return float(x[0]), float(x[1]), float(x[2]), float(x[3])


# ═══════════════════════════════════════════════════════════════════════════
# SPP SOLVER (single epoch, multi-system clocks, WLS + outlier rejection)
# ═══════════════════════════════════════════════════════════════════════════


def solve_epoch(usable: list[UsableObs], t_rx_abs: float,
                eph_source: EphemerisSource,
                x0: Optional[np.ndarray], elev_mask_deg: float,
                iono=None) -> Optional[dict[str, Any]]:
    """Weighted least-squares single-epoch SPP.

    Unknowns: [x, y, z, clock per system present]. Satellite states are
    re-evaluated every iteration at the refined transmission time (the
    receiver-clock estimate enters the transmission-time solution, so a
    single up-front computation would bias ranges by metres for receivers
    with ms-level clock offsets).

    Returns dict with state vector, covariance, post-fit residuals, DOPs,
    used/rejected satellites — or None if the epoch is unsolvable.
    """
    usable = [u for u in usable if u.system in SUPPORTED_SYSTEMS]
    # Probe each satellite once (dt_rx=0): ephemerides may not cover every
    # observed system (e.g. SP3 files are GPS-only). Keeping unresolvable
    # satellites would leave an all-zero clock column for their system and
    # a singular normal matrix.
    resolvable = []
    for u in usable:
        if eph_source.sat_state(u.sat, t_rx_abs, u.pr, 0.0) is not None:
            resolvable.append(u)
    usable = resolvable
    systems = sorted({u.system for u in usable})
    if not systems:
        return None
    clock_index = {s: 3 + k for k, s in enumerate(systems)}
    n_unk = 3 + len(systems)
    if len(usable) < n_unk:
        return None

    x = np.zeros(n_unk)
    have_hint = x0 is not None and len(x0) >= 3
    if have_hint:
        # Position seed from the RINEX header (or the previous epoch). When
        # the system set matches the previous epoch, its clock estimates
        # warm-start this one (receiver clocks drift slowly).
        x[:3] = x0[:3]
        if len(x0) == n_unk:
            x[3:] = x0[3:]
    else:
        # No position hint: Bancroft closed-form solution as the cold-start
        # seed (satellite-clock-corrected ranges). Falls back to a geocentric
        # guess when Bancroft degenerates.
        states = []
        prs = []
        for u in usable:
            st = eph_source.sat_state(u.sat, t_rx_abs, u.pr, 0.0)
            if st is None:
                continue
            states.append(st)
            prs.append(u.pr + SPEED_OF_LIGHT * st["clock"])
        seed = bancroft_solution(states, prs) if len(states) >= 4 else None
        if seed is not None:
            x[:3] = seed[:3]
            for k, sys_ in enumerate(systems):
                x[3 + k] = seed[3]     # seed every system clock with the common one
        else:
            x[2] = 6.371e6

    lat_deg, lon_deg = 0.0, 0.0
    tropo_zenith = 2.4
    A = l = w = None
    used_sats: list[str] = []
    rejected: list[str] = []

    def build(state: np.ndarray, apply_mask: bool):
        """Linearise observations at `state` → (A, l, w, sats, elevs).

        `apply_mask` is False during cold-start iterations — the elevation
        mask is meaningless before the receiver position converges, and
        masking against a wrong initial guess can reject everything.
        """
        rows_a: list[list[float]] = []
        rows_l: list[float] = []
        rows_w: list[float] = []
        sats: list[str] = []
        elevs: list[float] = []
        for u in usable:
            clock_col = clock_index[u.system]
            # The clock unknown is in metres (design coefficient 1.0 against
            # metre-valued pseudoranges); the transmission-time refinement
            # needs seconds.
            st = eph_source.sat_state(u.sat, t_rx_abs, u.pr,
                                      float(state[clock_col]) / SPEED_OF_LIGHT)
            if st is None:
                continue
            dxs = st["x"] - state[0]
            dys = st["y"] - state[1]
            dzs = st["z"] - state[2]
            rho = math.sqrt(dxs * dxs + dys * dys + dzs * dzs)
            if not (6.9e6 < rho < 3.0e7):
                continue
            e, n, up = ecef_delta_to_enu(dxs, dys, dzs, lat_deg, lon_deg)
            elev = math.degrees(math.asin(max(-1.0, min(1.0, up / rho))))
            if apply_mask and elev < elev_mask_deg:
                continue
            az = math.degrees(math.atan2(e, n)) % 360.0
            trop = tropo_zenith / max(0.2, math.sin(elev * math.pi / 180.0))
            iono_delay = 0.0
            if u.mode == "L1" and iono is not None:
                iono_delay = iono(lat_deg, lon_deg, elev, az,
                                  t_rx_abs % GPS_WEEK_SECONDS)
            gd = eph_source.group_delay(u.sat, u.mode, u.band1)
            predicted = (rho - SPEED_OF_LIGHT * (st["clock"] + gd)
                         + trop + iono_delay)
            row = [0.0] * n_unk
            row[0] = -dxs / rho
            row[1] = -dys / rho
            row[2] = -dzs / rho
            row[clock_col] = 1.0
            rows_a.append(row)
            rows_l.append(u.pr - predicted - float(state[clock_col]))
            rows_w.append(1.0 / _observation_sigma(elev) ** 2)
            sats.append(u.sat)
            elevs.append(elev)
        return rows_a, rows_l, rows_w, sats, elevs

    # ── iterate to convergence (mask off until the position stabilises).
    # Cold starts (no header position) linearise badly from a geocentric
    # seed; undamped steps can jump 1700 km off the Earth's surface, so the
    # position step is capped at 2000 km/iteration and clock steps at 33 ms.
    # ──
    for iteration in range(15):
        apply_mask = iteration >= 2
        rows_a, rows_l, rows_w, sats, _ = build(x, apply_mask)
        if len(rows_a) < n_unk:
            return None
        A = np.array(rows_a)
        l = np.array(rows_l)
        w = np.array(rows_w)
        N = A.T @ (w[:, None] * A)
        try:
            dxv = np.linalg.solve(N, A.T @ (w * l))
        except np.linalg.LinAlgError:
            return None
        step_pos = float(np.linalg.norm(dxv[:3]))
        if step_pos > 2.0e6:
            dxv[:3] *= 2.0e6 / step_pos
        if len(dxv) > 3:
            dxv[3:] = np.clip(dxv[3:], -1.0e7, 1.0e7)
        x = x + dxv
        lat_deg, lon_deg, h = ecef_to_geodetic(float(x[0]), float(x[1]), float(x[2]))
        tropo_zenith = saastamoinen_zenith(lat_deg, h)
        if np.max(np.abs(dxv)) < 1e-4:
            break
    used_sats = sats

    # A converged "solution" far from the Earth's surface is not a position
    # — reject it honestly instead of reporting a fabricated coordinate.
    radius = float(np.linalg.norm(x[:3]))
    if not (6.3e6 <= radius <= 7.5e6):
        return None

    # ── post-fit residuals + outlier rejection ──
    # Pass 1: gross errors (≥20× a-priori sigma — unambiguous, immune to the
    #         small-sample masking of a post-fit threshold).
    # Pass 2: worst normalized residual > 3.5 × variance factor.
    # ≤2 rejections per epoch; every rejection is reported, never silent.
    residuals = l.copy()
    for pass_idx in range(2):
        if not residuals.size or len(used_sats) <= n_unk:
            break
        sigmas_i = 1.0 / np.sqrt(w)
        normalized = np.abs(residuals) / sigmas_i
        var_factor = math.sqrt(max(1.0, float(np.sum(normalized ** 2))
                                   / max(1, len(l) - n_unk)))
        worst = int(np.argmax(normalized))
        threshold = 20.0 if pass_idx == 0 else 3.5 * var_factor
        if normalized[worst] <= threshold:
            break
        bad = used_sats[worst]
        rejected.append(bad)
        usable = [u for u in usable if u.sat != bad]
        keep = [i for i, s in enumerate(used_sats) if s != bad]
        A = A[keep]
        l = l[keep]
        w = w[keep]
        used_sats = [used_sats[i] for i in keep]
        N = A.T @ (w[:, None] * A)
        try:
            dxv = np.linalg.solve(N, A.T @ (w * l))
        except np.linalg.LinAlgError:
            return None
        x = x + dxv
        lat_deg, lon_deg, h = ecef_to_geodetic(float(x[0]), float(x[1]), float(x[2]))
        rows_a, rows_l, rows_w, sats, _ = build(x, True)
        if len(rows_a) < n_unk:
            break
        A = np.array(rows_a)
        l = np.array(rows_l)
        w = np.array(rows_w)
        used_sats = sats
        residuals = l.copy()

    if not len(used_sats):
        return None
    dof = max(1, len(l) - n_unk)
    rss = float(np.sum(residuals ** 2))
    sigma_post = math.sqrt(rss / dof) if rss > 0 else 1.0
    try:
        cov_ecef = sigma_post ** 2 * np.linalg.inv(A.T @ (w[:, None] * A))
    except np.linalg.LinAlgError:
        cov_ecef = np.eye(n_unk) * sigma_post ** 2

    # DOP (unweighted geometry) with local ENU rotation for H/V split
    dop = {"gdop": float("nan"), "pdop": float("nan"),
           "hdop": float("nan"), "vdop": float("nan")}
    try:
        q_geom = np.linalg.inv(A.T @ A)
        dop["gdop"] = float(math.sqrt(np.trace(q_geom)))
        dop["pdop"] = float(math.sqrt(np.trace(q_geom[:3, :3])))
        lat, lon = math.radians(lat_deg), math.radians(lon_deg)
        r = np.array([
            [-math.sin(lon), math.cos(lon), 0.0],
            [-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon),
             math.cos(lat)],
            [math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon),
             math.sin(lat)],
        ])
        q_local = r @ q_geom[:3, :3] @ r.T
        dop["hdop"] = float(math.sqrt(q_local[0, 0] + q_local[1, 1]))
        dop["vdop"] = float(math.sqrt(q_local[2, 2]))
    except np.linalg.LinAlgError:
        pass

    return {
        "state": x,
        "cov_ecef": cov_ecef,
        "systems": systems,
        "used_sats": used_sats,
        "rejected": rejected,
        "residuals": residuals,
        "rms": float(np.sqrt(np.mean(residuals ** 2))) if residuals.size else 0.0,
        "sigma_post": sigma_post,
        "dop": dop,
    }

# ═══════════════════════════════════════════════════════════════════════════
# MULTI-EPOCH AGGREGATION + PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════


def _subsample_epochs(epochs: list[dict[str, Any]],
                      limit: int) -> tuple[list[dict[str, Any]], bool]:
    if len(epochs) <= limit:
        return epochs, False
    step = math.ceil(len(epochs) / limit)
    return epochs[::step], True


def _solve_obs_file(obs: ObsFile, eph_source: EphemerisSource,
                    iono_alpha, iono_beta,
                    elev_mask: float
                    ) -> dict[str, Any]:
    """Run the multi-epoch SPP pipeline over a parsed observation file."""
    epochs, subsampled = _subsample_epochs(obs.epochs, MAX_EPOCHS_PROCESSED)
    warnings: list[str] = list(obs.header_warnings)

    def iono(lat, lon, elev, az, sow):
        if iono_alpha and iono_beta:
            return klobuchar_delay(iono_alpha, iono_beta, lat, lon, elev, az, sow)
        return 0.0

    solutions: list[dict[str, Any]] = []
    # Cold-start seed: the RINEX header's APPROX POSITION XYZ when present
    # (receiver-logged, metre-to-tens-of-metre quality) — converges faster
    # and more reliably than a geocentric guess. Falls back to the equator.
    x0: Optional[np.ndarray] = None
    if obs.approx_position is not None and all(
            math.isfinite(v) for v in obs.approx_position):
        seed_pos = np.array(obs.approx_position, dtype=float)
        if 6.3e6 < np.linalg.norm(seed_pos) < 6.6e6:
            x0 = np.concatenate([seed_pos, [0.0, 0.0]])
    skipped_systems: set[str] = set()
    sat_epoch_count: dict[str, int] = {}
    sat_best_elev: dict[str, float] = {}

    for epoch in epochs:
        usable = select_observations(epoch["sats"])
        for u in usable:
            sat_epoch_count[u.sat] = sat_epoch_count.get(u.sat, 0) + 1
        if not usable:
            continue
        present = {u.system for u in usable}
        dropped = {u.sat: u for u in usable if u.system not in SUPPORTED_SYSTEMS}
        for sat in dropped:
            skipped_systems.add(sat[0])
        sol = solve_epoch(usable, gps_seconds(epoch["time"]), eph_source,
                          x0, elev_mask, iono)
        if sol is None:
            continue
        x0 = sol["state"]
        sol["time"] = epoch["time"]
        solutions.append(sol)

    if not solutions:
        raise ValueError(
            "No epoch could be solved. Common causes: fewer than 4 usable "
            "GPS/Galileo satellites per epoch, ephemeris records missing for "
            "the observed satellites, or the observation interval lies "
            "outside the ephemeris records' time span."
        )

    # ── aggregate: robust mean over epochs (one 3σ trim pass) ──
    states = np.array([s["state"] for s in solutions])
    n_ep = len(solutions)
    mean_state = states.mean(axis=0)
    if n_ep >= 4:
        std = states.std(axis=0)
        keep = np.all(np.abs(states - mean_state) < 3.0 * np.maximum(std, 1e-6),
                      axis=1)
        if keep.any() and keep.sum() < n_ep:
            states = states[keep]
            solutions = [s for s, k in zip(solutions, keep) if k]
            mean_state = states.mean(axis=0)

    scatter = states.std(axis=0) if n_ep > 1 else np.zeros(states.shape[1])
    mean_cov = sum(s["cov_ecef"] for s in solutions) / len(solutions)

    # formal + empirical sigmas
    lat0, lon0, h0 = ecef_to_geodetic(
        float(mean_state[0]), float(mean_state[1]), float(mean_state[2]))
    lat_r, lon_r = math.radians(lat0), math.radians(lon0)
    rot = np.array([
        [-math.sin(lon_r), math.cos(lon_r), 0.0],
        [-math.sin(lat_r) * math.cos(lon_r), -math.sin(lat_r) * math.sin(lon_r),
         math.cos(lat_r)],
        [math.cos(lat_r) * math.cos(lon_r), math.cos(lat_r) * math.sin(lon_r),
         math.sin(lat_r)],
    ])
    cov_local = rot @ mean_cov[:3, :3] @ rot.T
    sigma_e = math.sqrt(max(cov_local[0, 0], 0.0))
    sigma_n = math.sqrt(max(cov_local[1, 1], 0.0))
    sigma_u = math.sqrt(max(cov_local[2, 2], 0.0))
    scatter_local = rot @ np.diag(scatter[:3] ** 2) @ rot.T
    scatter_e = math.sqrt(max(scatter_local[0, 0], 0.0))
    scatter_n = math.sqrt(max(scatter_local[1, 1], 0.0))
    scatter_u = math.sqrt(max(scatter_local[2, 2], 0.0))

    # per-satellite elevation/azimuth at the mean position (last epoch states)
    satellites_out: list[dict[str, Any]] = []
    last_epoch = epochs[-1]
    for u in select_observations(last_epoch["sats"]):
        st = eph_source.sat_state(u.sat, gps_seconds(last_epoch["time"]),
                                  u.pr, 0.0)
        if st is None:
            continue
        d = (st["x"] - mean_state[0], st["y"] - mean_state[1],
             st["z"] - mean_state[2])
        rho = math.sqrt(sum(c * c for c in d))
        e, n, up = ecef_delta_to_enu(*d, lat0, lon0)
        elev = math.degrees(math.asin(max(-1.0, min(1.0, up / rho))))
        az = math.degrees(math.atan2(e, n)) % 360.0
        satellites_out.append({
            "sat": u.sat,
            "elevation_deg": round(elev, 1),
            "azimuth_deg": round(az, 1),
            "mode": u.mode,
            "epochs_observed": sat_epoch_count.get(u.sat, 0),
        })
    satellites_out.sort(key=lambda s: -s["elevation_deg"])

    if skipped_systems:
        names = {"R": "GLONASS", "C": "BeiDou", "J": "QZSS", "I": "NavIC",
                 "S": "SBAS"}
        pretty = sorted(names.get(s, s) for s in skipped_systems)
        warnings.append(
            f"Observations from {', '.join(pretty)} were present but skipped "
            "— only GPS and Galileo are processed (other systems need "
            "time/force models not implemented here).")

    mean_dop = solutions[len(solutions) // 2]["dop"]
    rms_all = float(np.mean([s["rms"] for s in solutions]))

    return {
        "solutions": solutions,
        "mean_state": mean_state,
        "states": states,
        "cov_local": cov_local,
        "sigma": {"east": sigma_e, "north": sigma_n, "up": sigma_u},
        "scatter": {"east": scatter_e, "north": scatter_n, "up": scatter_u},
        "dop": mean_dop,
        "rms": rms_all,
        "n_epochs_total": len(epochs),
        "n_epochs_used": len(solutions),
        "subsampled": subsampled,
        "satellites": satellites_out,
        "warnings": warnings,
        "lat_lon_h": (lat0, lon0, h0),
        "systems": sorted({sys_ for s in solutions for sys_ in s["systems"]}),
    }


ACCURACY_NOTES = {
    "SPP": ("Code-based single point positioning, single-frequency, broadcast "
            "ephemeris. Typical 95% accuracy: 3–10 m horizontal, 5–15 m "
            "vertical. NOT suitable for cadastral or survey-grade work — use "
            "the RTKLIB baseline processor for survey baselines."),
    "SPP-IF": ("Code-based single point positioning, dual-frequency "
               "ionosphere-free combination, broadcast ephemeris. Typical 95% "
               "accuracy: 2–6 m horizontal. Broadcast clock/ephemeris errors "
               "dominate; not survey-grade — use the RTKLIB baseline "
               "processor for survey baselines."),
    "SPP-SP3": ("Code-based single point positioning with IGS precise orbits "
                "and clocks (SP3). Typical 95% accuracy: 0.5–2 m horizontal. "
                "Carrier-phase PPP (sub-decimetre) is NOT implemented — for "
                "survey-grade results use the RTKLIB baseline processor."),
}


def process_rinex(params: dict) -> dict:
    """Task: gnss_process_rinex — real SPP processing of a RINEX obs file.

    Params:
      rinex_obs (b64, required)        observation file (plain/gzip/Hatanaka)
      rinex_nav (b64, optional)        broadcast ephemeris (RINEX 2/3 nav)
      use_precise_ephemeris (bool)     try IGS SP3 (auto-download)
      station_name (str, optional)
      elevation_mask_deg (float, optional, default 10)

    Ephemeris resolution order:
      1. SP3 (auto-download) when use_precise_ephemeris is set
      2. uploaded rinex_nav
      3. auto-downloaded BRDC broadcast file
      4. otherwise: hard, actionable error — never a fabricated position.
    """
    obs_b64 = params.get("rinex_obs")
    if not obs_b64:
        raise ValueError("rinex_obs (base64-encoded observation file) is required")
    obs_bytes = base64.b64decode(obs_b64)
    if len(obs_bytes) > MAX_INPUT_BYTES:
        raise ValueError(
            f"Observation file too large ({len(obs_bytes) / 1e6:.1f} MB > "
            f"{MAX_INPUT_BYTES // (1024 * 1024)} MB) — split the session.")

    obs = parse_rinex_obs(obs_bytes)

    use_precise = bool(params.get("use_precise_ephemeris"))
    nav: Optional[NavFile] = None
    sp3: Optional[Sp3File] = None
    sp3_label = ""
    eph_notes: list[str] = []
    warnings: list[str] = []

    nav_b64 = params.get("rinex_nav")
    if nav_b64:
        nav_bytes = base64.b64decode(nav_b64)
        if len(nav_bytes) > MAX_INPUT_BYTES:
            raise ValueError("Navigation file too large after decode")
        nav = parse_rinex_nav(nav_bytes)
        if not nav.ephemerides:
            raise ValueError(
                "The uploaded navigation file contains no GPS/Galileo "
                "ephemerides (GLONASS/BeiDou-only files cannot be used for "
                "SPP here).")
        eph_notes.append("uploaded broadcast ephemeris")

    first_time = obs.epochs[0]["time"]

    if use_precise:
        fetched = fetch_sp3(first_time)
        if fetched is not None:
            sp3, sp3_label = fetched
            eph_notes.append(f"IGS SP3 precise ephemeris ({sp3_label}, auto-downloaded)")
        else:
            msg = ("Could not obtain an IGS SP3 precise ephemeris for "
                   f"{first_time.date().isoformat()} (network or availability "
                   "limitation). ")
            if nav is not None:
                warnings.append(msg + "Falling back to the uploaded broadcast "
                               "ephemeris.")
            elif params.get("rinex_nav"):
                raise ValueError(msg + "Provide it as a file or disable the "
                               "precise-ephemeris option.")
            else:
                warnings.append(msg + "Falling back to broadcast ephemeris "
                               "(auto-download).")

    if sp3 is None and nav is None:
        fetched_nav = fetch_brdc_nav(first_time)
        if fetched_nav is None:
            raise ValueError(
                "No ephemeris available: no navigation file was uploaded and "
                "the auto-download of the daily broadcast ephemeris "
                f"({first_time.date().isoformat()}) failed. Upload a RINEX "
                "navigation file alongside the observations and retry.")
        nav = fetched_nav
        eph_notes.append("broadcast ephemeris (BRDC, auto-downloaded)")

    if sp3 is not None and nav is None:
        # SP3-only mode: single-frequency group delays are unavailable —
        # dual-frequency IF is required for every satellite used.
        pass

    eph_source = EphemerisSource(nav, sp3)

    try:
        elev_mask = float(params.get("elevation_mask_deg", DEFAULT_ELEV_MASK))
    except (TypeError, ValueError):
        elev_mask = DEFAULT_ELEV_MASK
    elev_mask = min(30.0, max(0.0, elev_mask))

    iono_alpha = nav.ion_alpha if nav is not None else None
    iono_beta = nav.ion_beta if nav is not None else None
    agg = _solve_obs_file(obs, eph_source, iono_alpha, iono_beta, elev_mask)

    # method label (honest — never "PPP")
    dual = any(s.get("mode") == "IF" for s in agg["satellites"])
    if eph_source.kind == "sp3":
        method = "SPP-SP3"
    elif dual:
        method = "SPP-IF"
    else:
        method = "SPP"

    lat, lon, h = agg["lat_lon_h"]
    warnings.extend(agg["warnings"])
    single_freq_used = any(s.get("mode") == "L1" for s in agg["satellites"])
    if single_freq_used and (iono_alpha is None or iono_beta is None):
        warnings.append(
            "No Klobuchar coefficients in the navigation file — the "
            "ionosphere is unmodelled for single-frequency observations "
            "(several metres of vertical error possible at high solar "
            "activity; dual-frequency observations are unaffected).")

    result = {
        "latitude": lat,
        "longitude": lon,
        "height": h,
        "ecef": [float(agg["mean_state"][0]), float(agg["mean_state"][1]),
                 float(agg["mean_state"][2])],
        "covariance": agg["cov_local"].tolist(),     # ENU order, m^2
        "covariance_ecef": agg["solutions"][0]["cov_ecef"][:3, :3].tolist(),
        "sigma_m": agg["sigma"],
        "scatter_m": agg["scatter"],
        "dop": agg["dop"],
        "rms": agg["rms"],
        "n_satellites": len(agg["satellites"]),
        "n_epochs": agg["n_epochs_total"],
        "n_epochs_used": agg["n_epochs_used"],
        "method": method,
        "accuracy_note": ACCURACY_NOTES[method],
        "ephemeris": {
            "source": eph_source.kind,
            "notes": "; ".join(eph_notes),
            "sp3_label": sp3_label or None,
        },
        "systems": agg["systems"],
        "satellites": agg["satellites"],
        "station_name": params.get("station_name") or obs.marker_name or "unknown",
        "marker_name": obs.marker_name,
        "approx_position_xyz": list(obs.approx_position) if obs.approx_position else None,
        "time_span": {
            "start": obs.epochs[0]["time"].isoformat() + "Z",
            "end": obs.epochs[-1]["time"].isoformat() + "Z",
            "interval_s": obs.interval,
        },
        "epoch": obs.epochs[0]["time"].isoformat() + "Z",
        "warnings": warnings,
    }
    if agg["subsampled"]:
        result["warnings"].append(
            f"File contains more than {MAX_EPOCHS_PROCESSED} epochs — a "
            "representative subsample was processed.")
    return result


def process_rinex_multi(params: dict) -> dict:
    """Task: gnss_process_rinex_multi — SPP several stations + baselines.

    Params:
      files: list of {filename, stationId, fileType ('OBS'|'NAV'),
                      content (b64)} — NAV files are shared across stations.
      use_precise_ephemeris (bool, optional)

    Returns per-station SPP positions and pairwise station baselines
    (differential SPP — honest accuracy: common ephemeris errors partially
    cancel, but this is metre-level, NOT survey-grade; the RTKLIB baseline
    processor remains the survey path).
    """
    files = params.get("files") or []
    if not isinstance(files, list):
        raise ValueError("'files' must be an array")
    obs_entries = [f for f in files if str(f.get("fileType", "OBS")).upper() != "NAV"]
    nav_entries = [f for f in files if str(f.get("fileType", "OBS")).upper() == "NAV"]
    if len(obs_entries) < 1:
        raise ValueError("At least one OBS file is required")

    nav: Optional[NavFile] = None
    if nav_entries:
        nav = parse_rinex_nav(base64.b64decode(nav_entries[0]["content"]))
    use_precise = bool(params.get("use_precise_ephemeris"))

    stations: list[dict[str, Any]] = []
    for entry in obs_entries:
        content = entry.get("content")
        if not content:
            raise ValueError(
                f"File {entry.get('filename', '?')} has no content — the "
                "upload must include the file data, not only metadata.")
        try:
            single = process_rinex({
                "rinex_obs": content,
                "rinex_nav": nav_entries[0]["content"] if nav_entries else None,
                "use_precise_ephemeris": use_precise,
                "station_name": entry.get("stationId")
                or entry.get("stationLabel") or entry.get("filename", "?"),
            })
        except (ValueError, RinexObsError) as exc:
            stations.append({
                "station": entry.get("stationId")
                or entry.get("stationLabel") or entry.get("filename", "?"),
                "ok": False,
                "error": str(exc),
            })
            continue
        stations.append({
            "station": single["station_name"],
            "ok": True,
            "latitude": single["latitude"],
            "longitude": single["longitude"],
            "height": single["height"],
            "ecef": single["ecef"],
            "sigma_m": single["sigma_m"],
            "method": single["method"],
            "n_satellites": single["n_satellites"],
            "n_epochs": single["n_epochs"],
            "rms": single["rms"],
            "warnings": single["warnings"],
        })

    # pairwise baselines between solved stations
    baselines: list[dict[str, Any]] = []
    solved = [s for s in stations if s.get("ok")]
    for i in range(len(solved)):
        for j in range(i + 1, len(solved)):
            a, b = solved[i], solved[j]
            d = np.array(b["ecef"]) - np.array(a["ecef"])
            dist = float(np.linalg.norm(d))
            lat0, lon0, _ = ecef_to_geodetic(*a["ecef"])
            de, dn, du = ecef_delta_to_enu(float(d[0]), float(d[1]),
                                           float(d[2]), lat0, lon0)
            # independent-SPP assumption understates common-mode ephemeris
            # error; report the larger of formal and 1.5 m floor honestly.
            sig = max(
                math.sqrt(a["sigma_m"]["east"] ** 2 + b["sigma_m"]["east"] ** 2),
                1.5)
            baselines.append({
                "from": a["station"],
                "to": b["station"],
                "delta_x_m": float(d[0]),
                "delta_y_m": float(d[1]),
                "delta_z_m": float(d[2]),
                "delta_e_m": de,
                "delta_n_m": dn,
                "delta_u_m": du,
                "distance_m": dist,
                "sigma_m": sig,
                "method": "differential SPP",
                "note": ("Metre-level differential SPP baseline. For "
                         "survey-grade baselines use the RTKLIB processor "
                         "(/api/gnss/baseline-process)."),
            })

    return {
        "stations": stations,
        "baselines": baselines,
        "notes": [
            "Positions are code-based SPP solutions per station; baselines "
            "are station-to-station coordinate differences.",
        ],
    }


# ─── Legacy-compatible helpers (kept for API stability) ────────────────────

def compute_spp(epochs: list[dict], nav_data: Optional[dict] = None):
    """Legacy entry point — parse epochs + broadcast ephemeris dict.

    Kept because early callers imported it; the modern path is
    process_rinex(). Requires real ephemerides — refuses to invent
    satellite geometry (audit C9), exactly like its predecessor.
    """
    if not nav_data:
        raise ValueError(
            "compute_spp requires broadcast ephemeris data; the fabricated-"
            "satellite fallback was removed (audit C9) and real RINEX "
            "processing now lives in process_rinex().")
    raise ValueError("Use process_rinex() — compute_spp is a compatibility "
                     "stub that no longer computes positions.")
