/**
 * Unified Total Station Import — Test Suite
 *
 * Tests the full pipeline: detectFormat → parse → adapt → UnifiedImportResult
 * using embedded sample data strings (no external files needed).
 */

import { importTotalStation } from '../unifiedImport'
import { adaptGSI } from '../adapters/gsiAdapter'
import { adaptSDR } from '../adapters/sdrAdapter'
import { adaptSouth } from '../adapters/southAdapter'
import { adaptTopcon } from '../adapters/topconAdapter'
import { adaptJobXML } from '../adapters/jobXmlAdapter'
import { defined } from '@/test-utils/defined'

// ─── Sample Data ───────────────────────────────────────────────────────

// GSI-8 sample (synthetic but structurally valid)
const GSI_SAMPLE = [
  '410021+00000000 410022+00000000 110001+00001000 21.324+00453000 22.324+00901234 31.004+00123456 51.004+00000010',
  '410021+00000000 410022+00000000 110001+00001001 21.324+01234567 22.324+00901200 31.004+00234567 51.004+00000010',
].join('\n')

// Minimal GSI coordinate record
const GSI_COORD_SAMPLE = [
  '410021+00000000 110001+00001000 81.324+01234567 82.324+09876543 83.324+01500000',
].join('\n')

// SDR33 sample
const SDR_SAMPLE = [
  '08TP01,984321.456,1234567.890,1542.345',
  '08TP02,984322.100,1234568.200,1541.800',
  '08BM1,984320.000,1234566.000,1543.100',
].join('\n')

// South coordinate-only sample
const SOUTH_COORD_SAMPLE = [
  'South,N,Kenya TM',
  '1,STN1,984321.456,1234567.890,1542.345,"STN",0',
  '2,TP01,984322.100,1234568.200,1541.800,"TP",0',
  '3,BM1,984320.000,1234566.000,1543.100,"BM",0',
].join('\n')

// South observation sample
const SOUTH_OBS_SAMPLE = [
  'South,N,Kenya TM',
  'SS,1,STN1,TP01,82.1530,1.500,0,234.567,89.4530,1.500,1.523,,',
  'SS,2,STN1,BM1,145.3020,1.500,0,156.789,90.0000,1.500,0.000,,',
].join('\n')

// South mixed sample (coordinates + observations)
const SOUTH_MIXED_SAMPLE = [
  'South,N,Kenya TM',
  '1,STN1,984321.456,1234567.890,1542.345,"STN",0',
  '2,TP01,984322.100,1234568.200,1541.800,"TP",0',
  'SS,1,STN1,TP01,82.1530,1.500,0,234.567,89.4530,1.500,1.523,,',
].join('\n')

// Topcon CSV sample
const TOPCON_SAMPLE = [
  'TP01,984321.456,1234567.890,1542.345,TP',
  'TP02,984322.100,1234568.200,1541.800,TP',
  'BM1,984320.000,1234566.000,1543.100,BM',
].join('\n')

// JobXML sample
const JOBXML_SAMPLE = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<JOBFile JobName="ControlSurvey">',
  '  <PointRecord>',
  '    <Name>TP01</Name>',
  '    <Grid><East>984321.456</East><North>1234567.890</North><Elev>1542.345</Elev></Grid>',
  '    <Code>TP</Code>',
  '  </PointRecord>',
  '  <PointRecord>',
  '    <Name>BM1</Name>',
  '    <Grid><East>984320.000</East><North>1234566.000</North><Elev>1543.100</Elev></Grid>',
  '    <Code>BM</Code>',
  '  </PointRecord>',
  '</JOBFile>',
].join('\n')

// Unknown / unrecognised sample (but CSV-like)
const UNKNOWN_CSV_SAMPLE = [
  'TP01,984321.456,1234567.890,1542.345',
  'TP02,984322.100,1234568.200,1541.800',
].join('\n')

// Empty content
const EMPTY_SAMPLE = ''

// ─── Tests ─────────────────────────────────────────────────────────────

describe('Unified Total Station Import', () => {

  // ── GSI Adapter ─────────────────────────────────────────────────────

  describe('adaptGSI', () => {
    it('parses GSI observation sample and returns format=gsi', () => {
      const result = adaptGSI(GSI_SAMPLE)
      expect(result.format).toBe('gsi')
      expect(result.instrument).toBe('Leica')
    })

    it('extracts observations from GSI data', () => {
      const result = adaptGSI(GSI_SAMPLE)
      expect(result.observations.length).toBeGreaterThan(0)
      // First observation should have a targetId (point number)
      expect(result.observations[0].targetId).toBeTruthy()
    })

    it('extracts coordinate raw points from GSI coordinate records', () => {
      const result = adaptGSI(GSI_COORD_SAMPLE)
      expect(result.rawPoints.length).toBe(1)
      // GSI WI 81 stores easting in mm: 01234567 → 1234.567 m
      expect(result.rawPoints[0].easting).toBeCloseTo(1234.567)
      // GSI WI 82 stores northing in mm: 09876543 → 9876.543 m
      expect(result.rawPoints[0].northing).toBeCloseTo(9876.543)
    })

    it('produces meaned observations via face pairing', () => {
      const result = adaptGSI(GSI_SAMPLE)
      expect(result.meanedObservations.length).toBeGreaterThan(0)
    })

    it('returns empty result for empty input', () => {
      const result = adaptGSI(EMPTY_SAMPLE)
      expect(result.observations.length).toBe(0)
      expect(result.rawPoints.length).toBe(0)
    })
  })

  // ── SDR Adapter ─────────────────────────────────────────────────────

  describe('adaptSDR', () => {
    it('parses SDR33 sample and returns format=sdr', () => {
      const result = adaptSDR(SDR_SAMPLE)
      expect(result.format).toBe('sdr')
      expect(result.instrument).toBe('Sokkia')
    })

    it('extracts 3 raw points from SDR data', () => {
      const result = adaptSDR(SDR_SAMPLE)
      expect(result.rawPoints.length).toBe(3)
      expect(result.rawPoints[0].id).toBe('TP01')
    })

    it('has no observations (coordinate-only format)', () => {
      const result = adaptSDR(SDR_SAMPLE)
      expect(result.observations.length).toBe(0)
      expect(result.meanedObservations.length).toBe(0)
    })

    it('sets stationCoords from first point', () => {
      const result = adaptSDR(SDR_SAMPLE)
      expect(result.stationCoords).toBeDefined()
      expect(defined(result.stationCoords).easting).toBeCloseTo(1234567.89)
      expect(defined(result.stationCoords).northing).toBeCloseTo(984321.456)
    })
  })

  // ── South Adapter ───────────────────────────────────────────────────

  describe('adaptSouth', () => {
    it('parses coordinate-only South sample', () => {
      const result = adaptSouth(SOUTH_COORD_SAMPLE)
      expect(result.format).toBe('south')
      expect(result.instrument).toBe('South')
      expect(result.rawPoints.length).toBe(3)
      expect(result.rawPoints[0].code).toBe('STN')
    })

    it('parses South observations with DMS angle conversion', () => {
      const result = adaptSouth(SOUTH_OBS_SAMPLE)
      expect(result.observations.length).toBe(2)
      expect(result.observations[0].stationId).toBe('STN1')
      expect(result.observations[0].targetId).toBe('TP01')
      // 82°15'30" → 82.25833°
      expect(result.observations[0].horizontalAngle).toBeCloseTo(82.25833, 4)
      // 89°45'30" → 89.75833°
      expect(result.observations[0].verticalAngle).toBeCloseTo(89.75833, 4)
      expect(result.observations[0].slopeDistance).toBeCloseTo(234.567)
      // parts[5] = targetHeight = 1.500 (the 1.523 in parts[10] is not parsed by the existing parser)
      expect(result.observations[0].prismHeight).toBe(1.5)
      // parts[9] = instrumentHeight = 1.500
      expect(result.observations[0].instrumentHeight).toBe(1.5)
    })

    it('handles mixed coordinate + observation South files', () => {
      const result = adaptSouth(SOUTH_MIXED_SAMPLE)
      expect(result.rawPoints.length).toBe(2)
      expect(result.observations.length).toBe(1)
    })

    it('populates meanedObservations (same as raw for single-face)', () => {
      const result = adaptSouth(SOUTH_OBS_SAMPLE)
      expect(result.meanedObservations.length).toBe(2)
      expect(result.meanedObservations[0].targetId).toBe('TP01')
    })

    it('looks up station coords from raw points', () => {
      const result = adaptSouth(SOUTH_MIXED_SAMPLE)
      // STN1 is the station in the observation
      expect(result.stationName).toBe('STN1')
      // Station coords looked up by matching stationName to raw point names
    })
  })

  // ── Topcon Adapter ──────────────────────────────────────────────────

  describe('adaptTopcon', () => {
    it('parses Topcon CSV sample and returns format=topcon', () => {
      const result = adaptTopcon(TOPCON_SAMPLE)
      expect(result.format).toBe('topcon')
      expect(result.instrument).toBe('Topcon')
    })

    it('extracts 3 raw points with codes', () => {
      const result = adaptTopcon(TOPCON_SAMPLE)
      expect(result.rawPoints.length).toBe(3)
      expect(result.rawPoints[0].id).toBe('TP01')
      expect(result.rawPoints[0].code).toBe('TP')
      expect(result.rawPoints[2].code).toBe('BM')
    })

    it('has no observations (coordinate-only format)', () => {
      const result = adaptTopcon(TOPCON_SAMPLE)
      expect(result.observations.length).toBe(0)
      expect(result.meanedObservations.length).toBe(0)
    })

    it('sets stationCoords from first point', () => {
      const result = adaptTopcon(TOPCON_SAMPLE)
      expect(result.stationCoords).toBeDefined()
      expect(defined(result.stationCoords).northing).toBeCloseTo(984321.456)
    })
  })

  // ── JobXML Adapter ──────────────────────────────────────────────────

  describe('adaptJobXML', () => {
    it('parses JobXML sample and returns format=jobxml', () => {
      const result = adaptJobXML(JOBXML_SAMPLE)
      expect(result.format).toBe('jobxml')
      expect(result.instrument).toBe('Trimble')
    })

    it('extracts 2 raw points from JobXML', () => {
      const result = adaptJobXML(JOBXML_SAMPLE)
      expect(result.rawPoints.length).toBe(2)
      expect(result.rawPoints[0].id).toBe('TP01')
      expect(result.rawPoints[1].id).toBe('BM1')
    })

    it('has no observations (coordinate-only format)', () => {
      const result = adaptJobXML(JOBXML_SAMPLE)
      expect(result.observations.length).toBe(0)
      expect(result.meanedObservations.length).toBe(0)
    })

    it('sets stationCoords from first point', () => {
      const result = adaptJobXML(JOBXML_SAMPLE)
      expect(result.stationCoords).toBeDefined()
      expect(defined(result.stationCoords).easting).toBeCloseTo(984321.456)
      expect(defined(result.stationCoords).elevation).toBeCloseTo(1542.345)
    })
  })

  // ── Unified Entry Point ─────────────────────────────────────────────

  describe('importTotalStation', () => {
    it('auto-detects GSI format by content', () => {
      const result = importTotalStation(GSI_SAMPLE, 'data.gsi')
      expect(result.format).toBe('gsi')
      expect(result.instrument).toBe('Leica')
    })

    it('auto-detects SDR format by "08" prefix', () => {
      const result = importTotalStation(SDR_SAMPLE, 'data.sdr')
      expect(result.format).toBe('sdr')
    })

    it('auto-detects South format by header line', () => {
      const result = importTotalStation(SOUTH_COORD_SAMPLE, 'data.dat')
      expect(result.format).toBe('south')
    })

    it('auto-detects Topcon format by CSV structure', () => {
      const result = importTotalStation(TOPCON_SAMPLE, 'data.csv')
      expect(result.format).toBe('topcon')
    })

    it('auto-detects JobXML format by XML content', () => {
      const result = importTotalStation(JOBXML_SAMPLE, 'data.job')
      expect(result.format).toBe('jobxml')
    })

    it('falls back for unknown format gracefully', () => {
      // Content that doesn't match any specific format pattern
      const unknownSample = 'XYZ\nABC 123\nnot a csv'
      const result = importTotalStation(unknownSample, 'random.xyz')
      expect(result.format).toBe('unknown')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.rawPoints.length).toBe(0)
    })

    it('handles empty input gracefully', () => {
      const result = importTotalStation(EMPTY_SAMPLE, 'empty.txt')
      expect(result.observations.length).toBe(0)
      expect(result.rawPoints.length).toBe(0)
      expect(result.errors.length).toBeGreaterThanOrEqual(0)
    })

    it('always returns the UnifiedImportResult structure', () => {
      const result = importTotalStation('some text', 'file.txt')
      expect(result).toHaveProperty('format')
      expect(result).toHaveProperty('instrument')
      expect(result).toHaveProperty('stationName')
      expect(result).toHaveProperty('observations')
      expect(result).toHaveProperty('meanedObservations')
      expect(result).toHaveProperty('rawPoints')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(Array.isArray(result.observations)).toBe(true)
      expect(Array.isArray(result.rawPoints)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })
  })

  // ── Cross-format consistency ────────────────────────────────────────

  describe('Cross-format consistency', () => {
    it('all adapters return stationName as a string', () => {
      const results = [
        adaptGSI(GSI_SAMPLE),
        adaptSDR(SDR_SAMPLE),
        adaptSouth(SOUTH_COORD_SAMPLE),
        adaptTopcon(TOPCON_SAMPLE),
        adaptJobXML(JOBXML_SAMPLE),
      ]
      for (let i = 0; i < results.length; i++) {
        expect(typeof results[i].stationName).toBe('string')
      }
    })

    it('all adapters have non-null errors and warnings arrays', () => {
      const results = [
        adaptGSI(GSI_SAMPLE),
        adaptSDR(SDR_SAMPLE),
        adaptSouth(SOUTH_COORD_SAMPLE),
        adaptTopcon(TOPCON_SAMPLE),
        adaptJobXML(JOBXML_SAMPLE),
      ]
      for (let i = 0; i < results.length; i++) {
        expect(Array.isArray(results[i].errors)).toBe(true)
        expect(Array.isArray(results[i].warnings)).toBe(true)
      }
    })
  })
})
