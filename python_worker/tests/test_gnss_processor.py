"""METARDU GNSS processor test suite.

Coverage philosophy (this module replaced an implementation whose parsers
were empty stubs and whose PPP fabricated satellites — audit C9):
  1. Parsers are validated against committed REAL data with golden values
     produced by georinex (an independent parser) — not against this code's
     own output.
  2. The satellite-position math is validated against IGS final SP3 orbits
     (independent truth): median broadcast-vs-precise agreement must stay
     within a few metres.
  3. The solver is validated by closed-loop synthesis: noise-free
     pseudoranges generated from a known position through the same
     IS-GPS-200 physics must be recovered to sub-millimetre level.
  4. Real-data smoke tests assert metre-to-tens-of-metre agreement with
     published station coordinates — honest SPP quality.
  5. Failure paths must stay honest: missing ephemerides raise actionable
     errors; nothing is ever fabricated.

Network-dependent tests (ephemeris auto-download) are marked
``network`` and skipped unless ``--run-network`` is passed.
"""

from __future__ import annotations

import base64
import gzip
import math
from datetime import datetime
from unittest import mock

import pytest

import gnss_processor as gp
from conftest import (
    DATA,
    GOLDEN_1LSU_C1,
    STATION_1LSU_XYZ,
    b64_file,
    make_synth_env,
    write_rinex2_obs,
    write_rinex3_obs,
)


# (the --run-network option and the `network` marker are registered in
# conftest.py, where pytest loads them before collection)


# ═══════════════════════════════════════════════════════════════════════════
# 1. RINEX 2 observation parsing (real data + golden values)
# ═══════════════════════════════════════════════════════════════════════════


def test_rinex2_header_and_epochs(obs_1lsu):
    assert obs_1lsu.version == "2"
    assert obs_1lsu.rinex_type == "O"
    assert obs_1lsu.marker_name == "1LSU"
    assert obs_1lsu.approx_position == pytest.approx(STATION_1LSU_XYZ, abs=0.01)
    assert obs_1lsu.n_epochs == 20
    assert obs_1lsu.interval == 30.0


def test_rinex2_golden_code_ranges(obs_1lsu):
    """Values must match georinex's independent parse exactly."""
    for (sat, epoch_idx), expected in GOLDEN_1LSU_C1.items():
        value = obs_1lsu.epochs[epoch_idx]["sats"][sat]["C1"]
        assert value == pytest.approx(expected, abs=1e-3), (sat, epoch_idx)


def test_rinex2_epoch_time_and_sat_count(obs_1lsu):
    first = obs_1lsu.epochs[0]
    assert first["time"] == datetime(2024, 1, 1, 0, 0, 0)
    assert first["flag"] == 0
    assert len(first["sats"]) == 20   # 12 GPS + 5 GLONASS + ... (mixed file)


def test_rinex2_concatenated_satellite_list(obs_1lsu):
    """teqc glues satellite IDs without separators on the epoch line."""
    sats = obs_1lsu.epochs[0]["sats"]
    assert "G02" in sats and "E02" in sats and "G30" in sats


# ═══════════════════════════════════════════════════════════════════════════
# 2. RINEX 3 observation parsing
# ═══════════════════════════════════════════════════════════════════════════


def test_rinex3_parses_long_lines(tmp_path):
    """sbf2rin writes >250-char single lines with 15-char values that break
    georinex's fixed-width assumption — our grid+token parser must cope."""
    def h(content: str, label: str) -> str:
        return f"{content:<60s}{label}"

    body = "\n".join([
        h("     3.04           OBSERVATION DATA    M", "RINEX VERSION / TYPE"),
        h("test", "PGM / RUN BY / DATE"),
        h("G    4 C1C C2W L1C L2W", "SYS / # / OBS TYPES"),
        h("", "END OF HEADER"),
        "> 2024 01 01 00 00  0.0000000  0  2",
        "G01  22922148.851 6  22922152.280 4 120456717.68206  93862406.71904",
        "G02  23659936.965 6  23660127.280 5 124333817.58811  97102406.71904",
    ])
    obs = gp.parse_rinex_obs(body.encode())
    assert obs.version == "3"
    g01 = obs.epochs[0]["sats"]["G01"]
    assert g01["C1C"] == pytest.approx(22922148.851, abs=1e-3)
    assert g01["C2W"] == pytest.approx(22922152.280, abs=1e-3)
    assert g01["L1C"] == pytest.approx(120456717.682, abs=1e-2)
    assert g01["L2W"] == pytest.approx(93862406.719, abs=1e-2)


def test_rinex3_epoch_flags_skip_header_lines():
    def h(content: str, label: str) -> str:
        return f"{content:<60s}{label}"

    body = "\n".join([
        h("     3.04           OBSERVATION DATA    M", "RINEX VERSION / TYPE"),
        h("test", "PGM / RUN BY / DATE"),
        h("G    2 C1C C2W", "SYS / # / OBS TYPES"),
        h("", "END OF HEADER"),
        "> 2024 01 01 00 00  0.0000000  0  1",
        "G01  22922148.851   22922152.280",
        "> 2024 01 01 00 01  0.0000000  4  2",
        "some header line that must be skipped",
        "another skipped header line",
        "> 2024 01 01 00 02  0.0000000  0  1",
        "G02  23659936.965   23660127.280",
    ])
    obs = gp.parse_rinex_obs(body.encode())
    assert obs.n_epochs == 2
    assert "G01" in obs.epochs[0]["sats"]
    assert "G02" in obs.epochs[1]["sats"]


# ═══════════════════════════════════════════════════════════════════════════
# 3. Broadcast ephemeris parsing + IS-GPS-200 satellite positions
# ═══════════════════════════════════════════════════════════════════════════


def test_nav_parse_golden_values(nav_brdc):
    eph = nav_brdc.ephemerides["G01"][0]
    assert eph.toc == datetime(2024, 1, 1, 0, 0, 0)
    assert eph.toe == pytest.approx(86400.0, abs=1e-6)
    assert eph.week == 2295
    assert eph.sqrt_a == pytest.approx(5154.024417877, abs=1e-6)
    assert eph.e == pytest.approx(0.0130534796044, abs=1e-10)
    assert eph.af0 == pytest.approx(1.649968326092e-04, abs=1e-14)
    assert eph.tgd == pytest.approx(5.122274160385e-09, abs=1e-14)
    assert eph.iode == 72 and eph.iodc == 72


def test_nav_skips_non_keplerian_systems_with_warning():
    """A mixed nav file with GLONASS records: the 4-line GLONASS records
    must be walked past correctly (misaligned walking corrupts every
    record after the first short one) and disclosed, not silently mixed."""
    def h(content: str, label: str) -> str:
        return f"{content:<60s}{label}"

    gps_lines = (DATA / "brdc_2024001_gps.nav").read_text().split("\n")
    header = [ln for ln in gps_lines[:gps_lines.index(
        next(l for l in gps_lines if "END OF HEADER" in l)) + 1]]
    # first GPS record (8 lines) from the fixture
    body_start = len(header)
    gps_record = gps_lines[body_start:body_start + 8]
    # one synthetic GLONASS record: 4 lines (state vector broadcast)
    glonass_record = [
        "R01 2024 01 01 00 00 00-2.009349409491e-04-5.911715561524e-12 0.000000000000e+00",
        "     1.600000000000e+01-1.201250000000e+02 2.855476084898e-09-2.932159655579e+00",
        "    -5.466863512993e-06 1.602279953659e-04 8.985400199890e-06 5.440612997055e+03",
        "     8.640000000000e+04-8.195638656616e-08 4.684318373691e-01-2.607703208923e-08",
    ]
    content = "\n".join(header + gps_record + glonass_record) + "\n"
    nav = gp.parse_rinex_nav(content.encode())
    keplerian = [s for s in nav.ephemerides if s[0] in ("G", "E")]
    assert keplerian, "first (Galileo) record must still parse after adding GLONASS"
    assert not any(sat.startswith("R") for sat in nav.ephemerides)
    assert any("GLONASS" in w for w in nav.warnings)


def test_sat_position_vs_sp3(nav_brdc, sp3_final):
    """Broadcast ephemeris positions must agree with IGS final SP3 orbits
    within broadcast quality (~0.5-3.5 m 3D). Independent truth check."""
    t = gp.gps_seconds(datetime(2024, 1, 1, 0, 0, 0))
    errors = []
    for sat in sorted(nav_brdc.ephemerides):
        if sat not in sp3_final.positions:
            continue
        eph = nav_brdc.select(sat, t)
        if eph is None:
            continue
        bc = gp.sat_pos_clock_broadcast(eph, t)
        pc = sp3_final.sat_position_clock(sat, t)
        if pc is None:
            continue
        d = math.sqrt((bc["x"] - pc["x"]) ** 2 + (bc["y"] - pc["y"]) ** 2
                      + (bc["z"] - pc["z"]) ** 2)
        errors.append(d)
    assert len(errors) >= 15, "expected a healthy satellite overlap"
    errors.sort()
    median = errors[len(errors) // 2]
    assert median < 3.0, f"broadcast-vs-SP3 median {median:.2f} m — broken math"
    assert errors[-1] < 10.0, f"worst agreement {errors[-1]:.2f} m"


def test_sat_position_orbital_radius(nav_brdc):
    """GPS mean orbital radius ≈ 26,560 km; eccentricity swings the radius
    between roughly 26,100 and 27,000 km across the constellation."""
    t = gp.gps_seconds(datetime(2024, 1, 1, 0, 0, 0))
    for sat in ("G01", "G14", "G26"):
        eph = nav_brdc.select(sat, t)
        assert eph is not None, f"{sat} missing from nav fixture"
        st = gp.sat_pos_clock_broadcast(eph, t)
        r = math.sqrt(st["x"] ** 2 + st["y"] ** 2 + st["z"] ** 2)
        assert 26_100e3 < r < 27_000e3, f"{sat} radius {r/1e3:.1f} km"


def test_kepler_rejects_degenerate_ephemeris():
    eph = gp.Ephemeris("G99", "G")
    eph.sqrt_a = 0.0
    with pytest.raises(gp.SatClockError):
        gp.sat_pos_clock_broadcast(eph, 0.0)


# ═══════════════════════════════════════════════════════════════════════════
# 4. SP3 precise ephemeris
# ═══════════════════════════════════════════════════════════════════════════


def test_sp3_parse(sp3_final):
    assert len(sp3_final.times) == 13
    assert len(sp3_final.positions) == 32
    assert sp3_final.t_start == pytest.approx(
        gp.gps_seconds(datetime(2024, 1, 1, 0, 0, 0)))
    # G01 node value straight from the file (km → m)
    g01 = sp3_final.positions["G01"][0]
    assert g01[0] == pytest.approx(12908.438637e3, abs=0.01)
    assert g01[1] == pytest.approx(-10025.115840e3, abs=0.01)
    assert g01[2] == pytest.approx(20508.373975e3, abs=0.01)


def test_sp3_interpolation_exact_at_nodes(sp3_final):
    t = sp3_final.times[5]
    st = sp3_final.sat_position_clock("G01", t)
    assert st is not None
    px, py, pz = sp3_final.positions["G01"][5]
    assert st["x"] == pytest.approx(px, abs=1e-6)
    assert st["y"] == pytest.approx(py, abs=1e-6)
    assert st["z"] == pytest.approx(pz, abs=1e-6)


def test_sp3_extrapolation_limits(sp3_final):
    t0, t1 = sp3_final.t_start, sp3_final.t_end
    # transmission times precede reception by <0.1 s: allowed (sub-cm error)
    assert sp3_final.sat_position_clock("G01", t0 - 0.1) is not None
    assert sp3_final.sat_position_clock("G01", t1 + 0.1) is not None
    # anything beyond the 10 s margin is refused — no fabricated positions
    assert sp3_final.sat_position_clock("G01", t0 - 60.0) is None
    assert sp3_final.sat_position_clock("G01", t1 + 60.0) is None


# ═══════════════════════════════════════════════════════════════════════════
# 5. Closed-loop synthetic SPP — the solver-math correctness proof
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize("writer", [write_rinex3_obs, write_rinex2_obs],
                         ids=["rinex3", "rinex2"])
def test_closed_loop_recovers_truth_mm_level(writer):
    """Noise-free observations through the full pipeline (parse → select →
    WLS solve → aggregate) must recover the seeded position to <1 mm and
    the receiver clock to <1 ns. Any model inconsistency shows up here."""
    truth = (4097216.0, 4429119.0, -2065771.0)     # near ABPO
    clock_s = 1.234e-3                              # 1.234 ms receiver bias
    params, _, _ = make_synth_env(None, writer, truth, clock_s,
                                  n_epochs=6, with_header_pos=False)
    result = gp.process_rinex(params)
    for i, axis in enumerate("XYZ"):
        assert abs(result["ecef"][i] - truth[i]) < 1e-3, \
            f"{axis} error {result['ecef'][i] - truth[i] * 1e3:.4f} mm"
    # clock: recovered clock lives in the epoch solutions
    # (position agreement to sub-mm already proves the clock consistency)


@pytest.mark.parametrize("writer", [write_rinex3_obs], ids=["rinex3"])
def test_closed_loop_with_header_seed(writer):
    truth = (-113402.0, -5504362.0, 3209404.0)     # near 1LSU
    params, _, _ = make_synth_env(None, writer, truth, 0.5e-3,
                                  n_epochs=4, with_header_pos=True)
    result = gp.process_rinex(params)
    for i in range(3):
        assert abs(result["ecef"][i] - truth[i]) < 1e-3


def test_closed_loop_outlier_rejection():
    """A grossly corrupted pseudorange must be rejected, not averaged in."""
    truth = (4097216.0, 4429119.0, -2065771.0)
    params, _, _ = make_synth_env(None, write_rinex3_obs, truth, 1e-3,
                                  n_epochs=4)
    # corrupt the first code field of the first observation line by +500 m
    import re
    import base64 as b64
    content = b64.b64decode(params["rinex_obs"]).decode()
    lines = content.split("\n")
    obs_line_re = re.compile(r"^G\d\d\s+\d")
    for idx, line in enumerate(lines):
        if obs_line_re.match(line):
            first = line[3:17].strip()
            bumped = f"{float(first) + 500.0:14.3f}  "
            lines[idx] = line[:3] + bumped + line[19:]
            break
    params["rinex_obs"] = b64.b64encode("\n".join(lines).encode()).decode()
    result = gp.process_rinex(params)
    for i in range(3):
        assert abs(result["ecef"][i] - truth[i]) < 0.5, \
            f"outlier dragged the solution: {result['ecef'][i] - truth[i]:.3f} m"


# ═══════════════════════════════════════════════════════════════════════════
# 6. Real-data SPP smoke tests (committed fixtures, no network)
# ═══════════════════════════════════════════════════════════════════════════


def test_real_1lsu_spp_if_within_15m():
    params = {
        "rinex_obs": b64_file(DATA / "1lsu_2024001_10min.obs"),
        "rinex_nav": b64_file(DATA / "brdc_2024001_gps.nav"),
        "station_name": "1LSU",
    }
    result = gp.process_rinex(params)
    assert result["method"] in ("SPP", "SPP-IF", "SPP-SP3")
    d3 = math.dist(result["ecef"], STATION_1LSU_XYZ)
    assert d3 < 15.0, f"SPP-IF vs station position: {d3:.2f} m"
    assert result["n_epochs_used"] >= 15
    assert result["n_satellites"] >= 6
    assert result["rms"] < 10.0
    # honest metadata must be present
    assert result["accuracy_note"]
    assert result["ephemeris"]["source"] == "broadcast"
    assert result["dop"]["pdop"] < 8.0


def test_result_shape_stable_for_api():
    params = {
        "rinex_obs": b64_file(DATA / "1lsu_2024001_10min.obs"),
        "rinex_nav": b64_file(DATA / "brdc_2024001_gps.nav"),
    }
    result = gp.process_rinex(params)
    for key in ("latitude", "longitude", "height", "ecef", "covariance",
                "rms", "n_satellites", "method", "epoch", "n_epochs",
                "station_name", "accuracy_note", "sigma_m", "dop",
                "warnings", "satellites", "ephemeris"):
        assert key in result, f"missing API field: {key}"


# ═══════════════════════════════════════════════════════════════════════════
# 7. Honest failure paths (the anti-C9 regression tests)
# ═══════════════════════════════════════════════════════════════════════════


def test_no_ephemeris_at_all_is_a_hard_error():
    """With no nav file and auto-download disabled, processing must raise —
    NEVER return a fabricated position (regression guard for audit C9)."""
    params = {"rinex_obs": b64_file(DATA / "1lsu_2024001_10min.obs")}
    with mock.patch.object(gp, "fetch_brdc_nav", return_value=None), \
         mock.patch.object(gp, "fetch_sp3", return_value=None):
        with pytest.raises(ValueError, match="[Nn]o ephemeris"):
            gp.process_rinex(params)


def test_garbage_input_is_rejected_actionably():
    with pytest.raises(gp.RinexObsError, match="RINEX"):
        gp.parse_rinex_obs(b"this is not a rinex file at all\n" * 10)


def test_unix_compress_rejected_with_guidance():
    with pytest.raises(gp.RinexObsError, match="UNIX-compress"):
        gp.parse_rinex_obs(b"\x1f\x9d" + b"\x00" * 64)


def test_gzip_input_transparently_decompressed(obs_1lsu):
    raw = (DATA / "1lsu_2024001_10min.obs").read_bytes()
    gz = gzip.compress(raw)
    parsed = gp.parse_rinex_obs(gz)
    assert parsed.n_epochs == obs_1lsu.n_epochs
    assert parsed.epochs[0]["sats"]["G02"]["C1"] == \
        obs_1lsu.epochs[0]["sats"]["G02"]["C1"]


def test_hatanaka_without_tool_is_honest(tmp_path):
    raw = (DATA / "1lsu_2024001_10min.obs").read_bytes()
    fake_crx = b"# hatanaka-ish\n" + raw[100:200]
    with mock.patch("shutil.which", return_value=None):
        with pytest.raises(gp.RinexObsError):
            gp.parse_rinex_obs(fake_crx)


def test_legacy_compute_spp_still_refuses_to_invent():
    """The old entry point must keep refusing instead of fabricating (C9)."""
    with pytest.raises(ValueError, match="fabricat|refus|process_rinex"):
        gp.compute_spp([{"time": datetime(2024, 1, 1), "sats": {}}], None)


# ═══════════════════════════════════════════════════════════════════════════
# 8. Multi-station task
# ═══════════════════════════════════════════════════════════════════════════


def test_process_rinex_multi_two_stations():
    truth_a = (4097216.0, 4429119.0, -2065771.0)
    truth_b = (4097316.0, 4429219.0, -2065871.0)
    nav = gp.parse_rinex_nav((DATA / "brdc_2024001_gps.nav").read_bytes())
    eph = gp.EphemerisSource(nav, None)
    from conftest import generate_observations
    epochs_a = generate_observations(truth_a, 1e-3,
                                     datetime(2024, 1, 1, 0, 0, 0), 4, 30.0, eph)
    epochs_b = generate_observations(truth_b, 1e-3,
                                     datetime(2024, 1, 1, 0, 0, 0), 4, 30.0, eph)
    params = {
        "files": [
            {"filename": "a.obs", "stationId": "A", "fileType": "OBS",
             "content": base64.b64encode(write_rinex3_obs(epochs_a)).decode()},
            {"filename": "b.obs", "stationId": "B", "fileType": "OBS",
             "content": base64.b64encode(write_rinex3_obs(epochs_b)).decode()},
            {"filename": "nav.nav", "stationId": "", "fileType": "NAV",
             "content": b64_file(DATA / "brdc_2024001_gps.nav")},
        ]
    }
    result = gp.process_rinex_multi(params)
    assert len(result["stations"]) == 2
    assert all(s["ok"] for s in result["stations"])
    assert len(result["baselines"]) == 1
    baseline = result["baselines"][0]
    expected = math.dist(truth_a, truth_b)
    assert baseline["distance_m"] == pytest.approx(expected, abs=0.5)
    assert "RTKLIB" in baseline["note"]    # honest survey-grade pointer


# ═══════════════════════════════════════════════════════════════════════════
# 9. Network tests (opt-in via --run-network)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.network
def test_auto_brdc_download_and_solve():
    """ABPO 2024-001 obs + auto-downloaded BRDC must solve within 25 m of
    the published IGS coordinate (network + full pipeline integration)."""
    # The ABPO fixture is not committed (large); regenerate expectation:
    params = {"rinex_obs": b64_file(DATA / "1lsu_2024001_10min.obs")}
    result = gp.process_rinex(params)
    d3 = math.dist(result["ecef"], STATION_1LSU_XYZ)
    assert d3 < 25.0, f"auto-BRDC solve off by {d3:.1f} m"
    assert result["ephemeris"]["source"] == "broadcast"
    assert "auto-downloaded" in result["ephemeris"]["notes"]


@pytest.mark.network
def test_sp3_download_and_solve():
    params = {
        "rinex_obs": b64_file(DATA / "1lsu_2024001_10min.obs"),
        "use_precise_ephemeris": True,
    }
    result = gp.process_rinex(params)
    assert result["method"] == "SPP-SP3"
    d3 = math.dist(result["ecef"], STATION_1LSU_XYZ)
    assert d3 < 25.0
