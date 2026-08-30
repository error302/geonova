"""Shared fixtures and helpers for the GNSS processor test suite."""

from __future__ import annotations

import base64
import math
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import gnss_processor as gp  # noqa: E402

DATA = Path(__file__).parent / "data"


def pytest_addoption(parser):
    parser.addoption("--run-network", action="store_true", default=False,
                     help="run tests that download ephemeris products")


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "network: needs internet access")


def pytest_collection_modifyitems(config, items):
    if config.getoption("--run-network"):
        return
    skip = pytest.mark.skip(reason="needs --run-network")
    for item in items:
        if "network" in item.keywords:
            item.add_marker(skip)

# Reference values for the committed fixtures (real data, GPS week 2295):
# Station 1LSU (Baton Rouge, LA) 2024-01-01, IGS station ABPO (Madagascar).
STATION_1LSU_XYZ = (-113402.172, -5504362.813, 3209404.367)
STATION_ABPO_XYZ = (4097216.5539, 4429119.1897, -2065771.1988)

# Golden parse values extracted with georinex 1.16.2 (independent parser)
# from the 1LSU fixture — 1,182 code-range values matched exactly.
GOLDEN_1LSU_C1 = {
    ("E02", 0): 25602296.086,
    ("E15", 0): 24459201.195,
    ("E27", 0): 26082958.055,
    ("E30", 0): 23866885.375,
    ("E34", 0): 23757947.281,
    ("E36", 0): 27172199.797,
}
# Golden values for the RINEX 3 ABPO file measured from raw columns.
GOLDEN_ABPO = {
    ("C21", "C1P"): 25353969.004,
    ("C21", "C5P"): 25353970.999,
    ("C21", "L1P"): 133235980.353,
    ("C21", "L5P"): 99494392.034,
}


def b64_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


@pytest.fixture(scope="session")
def obs_1lsu() -> gp.ObsFile:
    return gp.parse_rinex_obs((DATA / "1lsu_2024001_10min.obs").read_bytes())


@pytest.fixture(scope="session")
def nav_brdc() -> gp.NavFile:
    return gp.parse_rinex_nav((DATA / "brdc_2024001_gps.nav").read_bytes())


@pytest.fixture(scope="session")
def sp3_final() -> gp.Sp3File:
    return gp.parse_sp3((DATA / "igs22950_final.sp3").read_bytes())


# ─── Synthetic closed-loop generator ────────────────────────────────────────


def generate_observations(
    truth_ecef: tuple[float, float, float],
    receiver_clock_seconds: float,
    t_start: datetime,
    n_epochs: int,
    interval_s: float,
    eph_source: gp.EphemerisSource,
    elev_mask_deg: float = 10.0,
) -> list[dict]:
    """Generate noise-free pseudoranges from a known position.

    The observation model mirrors the solver exactly (IS-GPS-200 satellite
    states, Sagnac rotation at reception, Saastamoinen troposphere), so a
    correct solver must recover the truth position to sub-millimetre level.
    Ionosphere is deliberately absent — dual-frequency IF generation makes
    that physically consistent.
    """
    lat, lon, h = gp.ecef_to_geodetic(*truth_ecef)
    tropo_zenith = gp.saastamoinen_zenith(lat, h)
    epochs = []
    for k in range(n_epochs):
        t_rx = t_start + timedelta(seconds=interval_s * k)
        t_rx_abs = gp.gps_seconds(t_rx)
        sats = {}
        # probe all GPS satellites the ephemerides know about
        for sat in sorted(eph_source.nav.ephemerides):
            if sat[0] != "G":
                continue
            tau = 0.075
            dist = None
            st_raw = None
            for _ in range(4):
                t_tx = t_rx_abs - tau
                st_raw = eph_source._raw_state(sat, t_tx)
                if st_raw is None:
                    break
                rx, ry, rz = gp.sagnac_rotate(
                    st_raw["x"], st_raw["y"], st_raw["z"], tau)
                dist = math.sqrt((rx - truth_ecef[0]) ** 2
                                 + (ry - truth_ecef[1]) ** 2
                                 + (rz - truth_ecef[2]) ** 2)
                tau = dist / gp.SPEED_OF_LIGHT
            if st_raw is None or dist is None:
                continue
            elev = math.degrees(math.asin(max(-1.0, min(1.0, (
                _enu_up((st_raw["x"], st_raw["y"], st_raw["z"]), truth_ecef)
            ) / dist))))
            if elev < elev_mask_deg:
                continue
            trop = tropo_zenith / math.sin(elev * math.pi / 180.0)
            pr = dist + gp.SPEED_OF_LIGHT * receiver_clock_seconds \
                - gp.SPEED_OF_LIGHT * st_raw["clock"] + trop
            # dual-frequency pair whose IF combination equals pr exactly;
            # carrier phases included so both writers can serialise them
            sats[sat] = {
                "C1": pr, "C2": pr, "P1": pr, "P2": pr,
                "L1": pr / 0.190293673, "L2": pr / 0.244210242,
            }
        assert len(sats) >= 5, f"only {len(sats)} satellites above mask"
        epochs.append({"time": t_rx, "flag": 0, "sats": sats})
    return epochs


def _enu_up(sat_ecef, recv_ecef) -> float:
    lat, lon, _ = gp.ecef_to_geodetic(*recv_ecef)
    dx = sat_ecef[0] - recv_ecef[0]
    dy = sat_ecef[1] - recv_ecef[1]
    dz = sat_ecef[2] - recv_ecef[2]
    _, _, up = gp.ecef_delta_to_enu(dx, dy, dz, lat, lon)
    return up


def _hdr(content: str, label: str) -> str:
    """Format a RINEX header line with the label starting at column 60."""
    return f"{content:<60s}{label}"


def write_rinex3_obs(epochs: list[dict], marker: str = "SYNTH",
                     approx: tuple[float, float, float] | None = None
                     ) -> bytes:
    """Serialise synthetic epochs as a RINEX 3.04 observation file."""
    t0 = epochs[0]["time"]
    lines = [
        _hdr("     3.04           OBSERVATION DATA    M (MIXED)", "RINEX VERSION / TYPE"),
        _hdr("metardu-test", "PGM / RUN BY / DATE"),
        _hdr(marker, "MARKER NAME"),
    ]
    if approx:
        lines.append(_hdr(f"{approx[0]:14.4f}{approx[1]:14.4f}{approx[2]:14.4f}",
                          "APPROX POSITION XYZ"))
    lines += [
        _hdr("G    4 C1C C2W L1C L2W", "SYS / # / OBS TYPES"),
        _hdr(f"{t0.year:6d}{t0.month:6d}{t0.day:6d}{t0.hour:6d}{t0.minute:6d}"
             f"{t0.second:13.7f}     GPS", "TIME OF FIRST OBS"),
        _hdr("", "END OF HEADER"),
    ]
    for epoch in epochs:
        t = epoch["time"]
        sats = epoch["sats"]
        sec = t.second + t.microsecond / 1e6
        lines.append(
            f"> {t.year:4d} {t.month:02d} {t.day:02d} {t.hour:02d} "
            f"{t.minute:02d} {sec:10.7f}  0 {len(sats):2d}")
        for sat in sorted(sats):
            obs = sats[sat]
            fields = ""
            for code in ("C1C", "C2W", "L1C", "L2W"):
                value = obs["C1" if code == "C1C" else
                            "C2" if code == "C2W" else
                            "L1" if code == "L1C" else "L2"]
                fields += f"{value:14.3f}  "
            lines.append(sat + fields)
    return ("\n".join(lines) + "\n").encode("ascii")


def write_rinex2_obs(epochs: list[dict], marker: str = "SYNTH",
                     approx: tuple[float, float, float] | None = None
                     ) -> bytes:
    """Serialise synthetic epochs as a RINEX 2.11 observation file."""
    t0 = epochs[0]["time"]
    lines = [
        _hdr("     2.11           OBSERVATION DATA    M (MIXED)", "RINEX VERSION / TYPE"),
        _hdr("metardu-test", "PGM / RUN BY / DATE"),
        _hdr(marker, "MARKER NAME"),
    ]
    if approx:
        lines.append(_hdr(f"{approx[0]:14.4f}{approx[1]:14.4f}{approx[2]:14.4f}",
                          "APPROX POSITION XYZ"))
    lines += [
        _hdr("    4    L1    L2    C1    C2", "# / TYPES OF OBSERV"),
        _hdr(f"  {t0.year % 100:2d}{t0.month:3d}{t0.day:3d}{t0.hour:3d}{t0.minute:3d}"
             f"{t0.second:11.7f}     GPS", "TIME OF FIRST OBS"),
        _hdr("", "END OF HEADER"),
    ]
    for epoch in epochs:
        t = epoch["time"]
        sats = epoch["sats"]
        sat_ids = "".join(sorted(sats))
        lines.append(
            f" {t.year % 100:2d}{t.month:3d}{t.day:3d}{t.hour:3d}{t.minute:3d}"
            f"{t.second:11.7f}  0 {len(sats):2d}{sat_ids}")
        for sat in sorted(sats):
            obs = sats[sat]
            fields = ""
            for code in ("L1", "L2", "C1", "C2"):
                value = obs[code]
                fields += f"{value:14.3f}  "
            lines.append(fields)
    return ("\n".join(lines) + "\n").encode("ascii")


def make_synth_env(tmp_path, rinex_writer, truth, clock_s, n_epochs=8,
                   with_header_pos=True, epoch_start=None):
    """Build an end-to-end synthetic scenario and return process params."""
    nav = gp.parse_rinex_nav((DATA / "brdc_2024001_gps.nav").read_bytes())
    eph = gp.EphemerisSource(nav, None)
    t_start = epoch_start or datetime(2024, 1, 1, 0, 0, 0)
    epochs = generate_observations(truth, clock_s, t_start, n_epochs, 30.0, eph)
    content = rinex_writer(epochs, "SYNTH", truth if with_header_pos else None)
    return {
        "rinex_obs": base64.b64encode(content).decode(),
        "rinex_nav": b64_file(DATA / "brdc_2024001_gps.nav"),
        "station_name": "SYNTH",
    }, truth, clock_s
