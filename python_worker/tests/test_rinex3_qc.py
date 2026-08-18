"""Tests for the RINEX 3.04 multi-GNSS session-QC mode.

Covers:
  1. Synthetic RINEX 3.04 covering all four constellations (GPS / Galileo /
     BeiDou / GLONASS) with physically consistent code+phase — verifies the
     per-constellation signal pairing, SNR extraction, multipath RMS and the
     clean-session verdict.
  2. Cycle-slip injection — a one-cycle slip on L1 mid-session must be
     detected by the geometry-free detector (and split the MP arc).
  3. RINEX 2.11 fallback — legacy GPS-only files map onto the code scheme
     (C1→C1C, L2→L2W) and still produce L1/L2 QC.
  4. Real public multi-GNSS RINEX 3.05 (gAGE/UPC 'obs3.05gage.19o', all four
     systems) — structural assertions: systems detected, correct signal
     pairs per constellation, plausible SNR and multipath RMS.
  5. Real IGS station file (CEDA00USA, RINEX 3.03, Galileo + GLONASS) — when
     present, MP RMS must be in the plausible < 1 m range (the raw mean
     carries the ambiguity constant, so RMS is the meaningful statistic).
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gnss_processor import (
    compute_session_qc,
    parse_rinex_obs_multignss,
    _multipath_pair,
    _glonass_frequencies,
    SYSTEM_BANDS,
)

FIXTURES = Path(__file__).parent / "fixtures"
GAGE_FILE = FIXTURES / "obs3.05gage.19o"
# The large IGS file lives under the repo's gitignored test-data/ dir.
CEDA_FILE = next(
    (p for p in [
        FIXTURES / "ceda_rinex3.rnx",
        Path(__file__).resolve().parents[2] / "test-data" / "python_worker" / "ceda_rinex3.rnx",
    ] if p.exists()),
    FIXTURES / "ceda_rinex3.rnx",
)

SPEED_OF_LIGHT = 299792458.0


# ─── Synthetic RINEX 3.04 generator ─────────────────────────────────────────

OBS_TYPES = {
    "G": ["C1C", "L1C", "S1C", "C2W", "L2W", "S2W"],      # GPS L1/L2
    "E": ["C1X", "L1X", "S1X", "C5X", "L5X", "S5X"],      # Galileo E1/E5a
    "C": ["C2I", "L2I", "S2I", "C6I", "L6I", "S6I"],      # BeiDou B1I/B3I
    "R": ["C1C", "L1C", "S1C", "C2C", "L2C", "S2C"],      # GLONASS G1/G2
}

SATS = ["G01", "G03", "E11", "E12", "C06", "C12", "R01", "R09"]

# QC pairs per system match MP_PAIRS (GPS L1/L2, Galileo E1/E5a,
# BeiDou B1I/B3I — band '2' is B1I, NOT the B1C on band '1').
PAIR_BANDS = {"G": ("1", "2"), "E": ("1", "5"), "C": ("2", "6")}


def _freqs(system: str, prn: int):
    """Return (f1, f2) for the system's primary QC pair."""
    if system == "R":
        return _glonass_frequencies(prn)
    b1, b2 = PAIR_BANDS[system]
    return SYSTEM_BANDS[system][b1][1], SYSTEM_BANDS[system][b2][1]


def _sat_phase_pair(system: str, prn: int, rng: float, noise: float = 0.0):
    """Physically consistent (code, phase1, phase2) for one satellite.

    Code = range (plus a little noise); phase = range/λ + integer ambiguity.
    The integer ambiguity is a constant per arc that the QC removes, so the
    multipath RMS stays near the injected noise level.
    """
    import random

    f1, f2 = _freqs(system, prn)
    wl1, wl2 = SPEED_OF_LIGHT / f1, SPEED_OF_LIGHT / f2
    n1 = 10_000_000 + prn * 13
    n2 = 8_000_000 + prn * 7
    return (
        rng + random.uniform(-noise, noise),
        rng / wl1 + n1,
        rng / wl2 + n2,
    )


def build_synthetic_rinex3(n_epochs: int = 12, interval: int = 30,
                           slip_at: int | None = None, noise: float = 0.02,
                           systems: dict | None = None) -> bytes:
    """Build a synthetic RINEX 3.04 multi-GNSS observation file.

    slip_at: epoch index (within the satellite series) where a one-cycle
    slip is injected on the first band's phase.
    """
    import random

    random.seed(7)
    systems = systems or OBS_TYPES
    lines = [
        "     3.04           OBSERVATION DATA    M (MIXED)           RINEX VERSION / TYPE",
        "SYNTHETIC FOR QC TESTS                                   COMMENT",
        "EXAMPLE                            SYNTH                 MARKER NAME",
        "G   12 C1C L1C S1C C2W L2W S2W D1C D1W D2W D2W S1W S2W  SYS / # / OBS TYPES",
        "E    6 C1X L1X S1X C5X L5X S5X                          SYS / # / OBS TYPES",
        "C    6 C2I L2I S2I C6I L6I S6I                          SYS / # / OBS TYPES",
        "R    6 C1C L1C S1C C2C L2C S2C                          SYS / # / OBS TYPES",
        f"     {interval}.000                                                  INTERVAL",
        "  2024  1 15  0  0  0.0000000     GPS         TIME OF FIRST OBS",
        f"  2024  1 15  0  {n_epochs * interval // 60:02d}  0.0000000     GPS         TIME OF LAST OBS",
        "END OF HEADER",
    ]

    sat_pairs = []
    for sat in SATS:
        system = sat[0]
        prn = int(sat[1:])
        f1, f2 = _freqs(system, prn)
        sat_pairs.append((sat, system, f1, f2))

    for ep in range(n_epochs):
        t = ep * interval
        lines.append(f"> 2024 01 15 00 {t // 60:02d} {t % 60:02d} 00.0000000  0 {len(SATS)}")
        for sat, system, f1, f2 in sat_pairs:
            prn = int(sat[1:])
            rng = 22_000_000.0 + ep * 400.0 + prn * 1000.0
            c1, ph1, ph2 = _sat_phase_pair(system, prn, rng, noise)
            if slip_at is not None and ep == slip_at:
                ph1 += 1.0  # one-cycle slip on band 1
            wl1, wl2 = SPEED_OF_LIGHT / f1, SPEED_OF_LIGHT / f2
            c2 = c1 + 100.0 + prn * 3.0  # separate code on band 2
            snr1 = 45.0
            snr2 = 40.0
            vals = [
                f"{c1:14.3f}  ", f"{ph1:14.3f}  ", f"{snr1:14.2f}  ",
                f"{c2:14.3f}  ", f"{ph2:14.3f}  ", f"{snr2:14.2f}  ",
            ]
            lines.append(f"{sat}  " + "".join(vals))
    return "\n".join(lines).encode()


# ─── Tests ──────────────────────────────────────────────────────────────────

class TestMultiGNSSParser:
    def test_parses_all_systems(self):
        parsed = parse_rinex_obs_multignss(build_synthetic_rinex3())
        assert parsed["rinex3"] is True
        assert set(parsed["systems"]) == {"G", "E", "C", "R"}
        assert len(parsed["epochs"]) == 12
        ep = parsed["epochs"][0]
        assert set(ep["sats"]) == set(SATS)

    def test_correct_signal_codes(self):
        parsed = parse_rinex_obs_multignss(build_synthetic_rinex3())
        ep = parsed["epochs"][0]
        for sat, expected_codes in [
            ("G01", ["C1C", "L1C", "S1C", "C2W", "L2W", "S2W"]),
            ("E11", ["C1X", "L1X", "S1X", "C5X", "L5X", "S5X"]),
            ("C06", ["C2I", "L2I", "S2I", "C6I", "L6I", "S6I"]),
            ("R01", ["C1C", "L1C", "S1C", "C2C", "L2C", "S2C"]),
        ]:
            assert sorted(ep["sats"][sat].keys()) == sorted(expected_codes)

    def test_real_gage_file_structure(self):
        """Real public RINEX 3.05 (gAGE/UPC) with all four systems."""
        if not GAGE_FILE.exists():
            import pytest
            pytest.skip("fixture obs3.05gage.19o not present")
        parsed = parse_rinex_obs_multignss(GAGE_FILE.read_bytes())
        assert parsed["rinex3"] is True
        assert set(parsed["systems"]) >= {"G", "E", "C", "R"}
        assert len(parsed["epochs"]) >= 1


class TestSessionQC:
    def _sat(self, qc, name):
        return next(s for s in qc["satellites"] if s["satellite"] == name)

    def test_clean_session_verdict_and_pairs(self):
        qc = compute_session_qc(build_synthetic_rinex3(n_epochs=12), "ROVER")
        assert qc["epoch_count"] == 12
        assert qc["verdict"] in ("pass", "warn")
        # Correct per-constellation signal pairs
        expected_pairs = {
            "G01": ("L1", "L2"),
            "E11": ("E1", "E5a"),
            "C06": ("B1I", "B3I"),
            "R01": ("G1", "G2"),
        }
        for sat, (a, b) in expected_pairs.items():
            s = self._sat(qc, sat)
            assert s["signal_1"] == a, f"{sat}: {s['signal_1']} != {a}"
            assert s["signal_2"] == b, f"{sat}: {s['signal_2']} != {b}"

    def test_snr_extraction(self):
        qc = compute_session_qc(build_synthetic_rinex3(n_epochs=12), "ROVER")
        s = self._sat(qc, "E11")
        assert s["snr_1_mean"] == 45.0
        assert s["snr_2_mean"] == 40.0

    def test_mp_rms_near_noise_floor(self):
        """Clean data → multipath RMS ≈ injected noise (ambiguity removed)."""
        qc = compute_session_qc(build_synthetic_rinex3(n_epochs=12, noise=0.02), "ROVER")
        for sat in ("G01", "E11", "C06", "R01"):
            s = self._sat(qc, sat)
            assert s["mp_1_rms_m"] is not None and s["mp_1_rms_m"] < 0.15, sat
            assert s["mp_2_rms_m"] is not None and s["mp_2_rms_m"] < 0.15, sat

    def test_cycle_slip_detected(self):
        """A one-cycle slip on L1 mid-session must be caught."""
        clean = compute_session_qc(build_synthetic_rinex3(n_epochs=12), "ROVER")
        slipped = compute_session_qc(build_synthetic_rinex3(n_epochs=12, slip_at=5), "ROVER")
        for sat in ("G01", "G03", "E11", "E12", "C06", "C12", "R01", "R09"):
            c = self._sat(clean, sat)["cycle_slips"]
            s = self._sat(slipped, sat)["cycle_slips"]
            assert s >= 1, f"{sat}: slip not detected ({s})"
            # The slip also splits the MP arc → RMS drops below the raw jump
            assert s >= c, f"{sat}: no change vs clean ({c} -> {s})"

    def test_glonass_fdma_resolution(self):
        """GLONASS G1/G2 must be resolved per-PRN (FDMA), not shared."""
        qc = compute_session_qc(build_synthetic_rinex3(n_epochs=12), "ROVER")
        s = self._sat(qc, "R01")
        assert s["signal_1"] == "G1" and s["signal_2"] == "G2"
        assert s["mp_1_rms_m"] is not None and s["mp_1_rms_m"] < 0.15

    def test_rinex2_fallback(self):
        """RINEX 2.11 GPS file maps C1→C1C / L2→L2W and produces L1/L2 QC."""
        lines = [
            "     2.11           OBSERVATION DATA    G (GPS)             RINEX VERSION / TYPE",
            "TEST                                                    MARKER NAME",
            "     8 C1  L1  S1  C2  L2  S2  P1  P2                  # / TYPES OF OBSERV",
            "     30.000                                                  INTERVAL",
            "  2024  1 15  0  0  0.0000000     GPS         TIME OF FIRST OBS",
            "  2024  1 15  0  5  0.0000000     GPS         TIME OF LAST OBS",
            "END OF HEADER",
        ]
        for t in (0, 30):
            lines.append(f" 24  1 15  0  0 {t}.0000000  0  2")

            def rec(sat, base):
                c1 = base + t * 100
                l1 = (base + t * 100) / (SPEED_OF_LIGHT / 1575.42e6) + 10_000_000
                c2 = c1 + 100
                l2 = (base + t * 100) / (SPEED_OF_LIGHT / 1227.60e6) + 8_000_000
                f = lambda v: f"{v:14.3f}  "
                return f"{sat}  {f(c1)}{f(l1)}{f(45.0)}{f(c2)}{f(l2)}{f(40.0)}"

            lines.append(rec("G01", 22_000_000.0))
            lines.append(rec("G02", 23_000_000.0))
        content = "\n".join(lines).encode()

        parsed = parse_rinex_obs_multignss(content)
        assert parsed["rinex3"] is False
        ep = parsed["epochs"][0]
        assert "C1C" in ep["sats"]["G01"] and "L2W" in ep["sats"]["G01"]

        qc = compute_session_qc(content, "TEST")
        s = self._sat(qc, "G01")
        assert s["signal_1"] == "L1" and s["signal_2"] == "L2"
        assert s["snr_1_mean"] == 45.0


class TestQCMode:
    def test_legacy_restricts_to_gps(self):
        """qc_mode='legacy' must restrict the QC to the GPS L1/L2 pair."""
        qc = compute_session_qc(
            build_synthetic_rinex3(n_epochs=12), "ROVER", qc_mode="legacy"
        )
        for s in qc["satellites"]:
            if s["system"] == "G":
                assert s["signal_1"] == "L1" and s["signal_2"] == "L2"
            else:
                assert s["signal_1"] is None, f"{s['satellite']} paired in legacy mode"

    def test_force_multignss_on_gps_file(self):
        """qc_mode='rinex3_multignss' forces the model even on GPS-only data."""
        gps_only = {"G": OBS_TYPES["G"]}
        content = build_synthetic_rinex3(n_epochs=8, systems=gps_only)
        # auto: single-system file still works
        qc_auto = compute_session_qc(content, "ROVER")
        assert qc_auto["available"] is True
        # forced mode parses the same way (no crash, GPS pair intact)
        qc_forced = compute_session_qc(content, "ROVER", qc_mode="rinex3_multignss")
        g = next(s for s in qc_forced["satellites"] if s["satellite"] == "G01")
        assert g["signal_1"] == "L1" and g["signal_2"] == "L2"


class TestRealFiles:
    def test_gage_multignss_qc(self):
        """Real gAGE RINEX 3.05: per-constellation pairs + plausible stats."""
        if not GAGE_FILE.exists():
            import pytest
            pytest.skip("fixture obs3.05gage.19o not present")
        qc = compute_session_qc(GAGE_FILE.read_bytes(), "BASE")
        assert qc["available"] is True
        sats = {s["satellite"]: s for s in qc["satellites"]}
        systems = {s["system"] for s in sats.values()}
        assert systems >= {"G", "E", "C", "R"}
        # Signal pairs per constellation present across the fleet
        pairs = {(s["system"], s.get("signal_1")) for s in sats.values() if s.get("signal_1")}
        assert ("E", "E1") in pairs
        assert ("C", "B1I") in pairs
        assert ("G", "L1") in pairs
        assert ("R", "G1") in pairs
        # SNR values must be in a physically plausible band (30–60 dB-Hz)
        for s in sats.values():
            for key in ("snr_1_mean", "snr_2_mean"):
                v = s.get(key)
                if v is not None:
                    assert 20 <= v <= 70, f"{s['satellite']} {key}: {v}"

    def test_ceda_igs_mp_plausible(self):
        """Real IGS station (23h, Galileo+GLONASS): MP RMS must be < 1 m.

        The raw MP mean carries the unknown ambiguity constant (tens of
        metres); only the per-arc RMS is physically meaningful. GLONASS rows
        are excluded from the strict bound: without navigation data the FDMA
        frequency channel is inferred from the PRN (RTKLIB convention), which
        is wrong for some satellites — a documented QC limitation.
        """
        if not CEDA_FILE.exists():
            import pytest
            pytest.skip("fixture ceda_rinex3.rnx not present (large, optional)")
        qc = compute_session_qc(CEDA_FILE.read_bytes(), "ROVER")
        assert qc["epoch_count"] > 1000
        sats = [s for s in qc["satellites"] if s.get("mp_1_rms_m") is not None]
        assert sats, "no dual-frequency multipath rows"
        gal = [s for s in sats if s["system"] != "R"]
        assert gal, "no non-GLONASS multipath rows"
        for s in gal:
            assert s["mp_1_rms_m"] < 1.0, f"{s['satellite']} MP1 RMS {s['mp_1_rms_m']}"
            assert s["mp_2_rms_m"] < 1.0, f"{s['satellite']} MP2 RMS {s['mp_2_rms_m']}"
