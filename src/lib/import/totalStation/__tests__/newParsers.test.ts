import { parseLandXML } from '../parseLandXML'
import { parseTrimbleDC } from '../parseTrimbleDC'
import { parseCarlsonRW5 } from '../parseCarlsonRW5'
import { importTotalStation } from '../unifiedImport'

describe('Direct Field File Parsers', () => {
  describe('LandXML Parser', () => {
    test('parses LandXML CgPoints coordinate records accurately', () => {
      const landXmlSample = `<?xml version="1.0"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">
  <Units>
    <Metric linearUnit="meter" areaUnit="squareMeter" volumeUnit="cubicMeter" temperatureUnit="celsius" pressureUnit="HPA" angularUnit="decimal degrees" />
  </Units>
  <CgPoints>
    <CgPoint name="BP1" code="IRON_PIN" desc="Boundary Beacon">9860100.500 254100.250 1650.000</CgPoint>
    <CgPoint name="BP2" code="IRON_PIN" desc="Boundary Beacon">9860250.750 254220.800 1655.200</CgPoint>
    <CgPoint name="TOPO_1" code="TREE">9860150.000 254150.000 1652.100</CgPoint>
  </CgPoints>
</LandXML>`

      const parsed = parseLandXML(landXmlSample)
      expect(parsed.records.length).toBe(3)
      expect(parsed.records[0].pointId).toBe('BP1')
      expect(parsed.records[0].northing).toBe(9860100.5)
      expect(parsed.records[0].easting).toBe(254100.25)
      expect(parsed.records[0].elevation).toBe(1650.0)
      expect(parsed.records[0].code).toBe('IRON_PIN')

      const unified = importTotalStation(landXmlSample, 'parcels.xml')
      expect(unified.rawPoints.length).toBe(3)
      expect(unified.rawPoints[0].id).toBe('BP1')
    })
  })

  describe('Trimble DC Parser', () => {
    test('parses Trimble DC Record 10 coordinate lines', () => {
      const dcSample = `00,Job1,Kenyan Cadastre Survey
01,STN1,1.550
10,STN1,9860000.000,254000.000,1640.000,CONTROL
10,T1,9860120.450,254080.320,1642.500,TRAVERSE
10,BP101,9860150.200,254110.800,1644.100,BEACON`

      const parsed = parseTrimbleDC(dcSample)
      expect(parsed.records.length).toBe(3)
      expect(parsed.records[1].pointId).toBe('T1')
      expect(parsed.records[1].northing).toBe(9860120.45)
      expect(parsed.records[1].easting).toBe(254080.32)
      expect(parsed.records[1].code).toBe('TRAVERSE')

      const unified = importTotalStation(dcSample, 'job1.dc')
      expect(unified.rawPoints.length).toBe(3)
      expect(unified.rawPoints[2].id).toBe('BP101')
    })
  })

  describe('Carlson SurvCE / FieldGenius RAW / RW5 Parser', () => {
    test('parses SP (Store Point) and OC (Occupied Station) records', () => {
      const rw5Sample = `JB,NMBlock4_Survey,DT08-26-2026,TM14:30:00
MO,AD0,UN1,SF1.000,EC0,EO0.0,AU0
OC,OP1,N 9860000.000,E 254000.000,EL 1650.000,--STN1
BK,OP1,BP1,BS180.0000,BC0.0000
SP,PN101,N 9860050.230,E 254080.450,EL 1651.200,--FENCE_START
SP,PN102,N 9860120.890,E 254110.120,EL 1653.400,--FENCE_END`

      const parsed = parseCarlsonRW5(rw5Sample)
      expect(parsed.records.length).toBe(3)
      expect(parsed.records[0].pointId).toBe('1') // OP1
      expect(parsed.records[1].pointId).toBe('101')
      expect(parsed.records[1].northing).toBe(9860050.23)
      expect(parsed.records[1].easting).toBe(254080.45)
      expect(parsed.records[1].code).toBe('FENCE_START')

      const unified = importTotalStation(rw5Sample, 'field.rw5')
      expect(unified.rawPoints.length).toBe(3)
      expect(unified.rawPoints[1].id).toBe('101')
    })
  })
})
