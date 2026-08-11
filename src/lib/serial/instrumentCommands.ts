/**
 * METARDU Total Station Command Protocols
 * ========================================
 * Command sets for controlling total stations from multiple manufacturers:
 *
 * - Leica: GSI-8/GSI-16 + GeoCOM (ASCII) commands
 * - Topcon: TOPCON ASCII commands (RC-232 / ExtLink)
 * - Trimble: Trimble Communications Protocol (TCP) + SSV commands
 * - Sokkia: SDR33 command set
 *
 * Each brand has its own command syntax for:
 * - Triggering measurements (angle + distance)
 * - Setting target (prism/prismless)
 * - Changing face (Face I / Face II)
 * - Setting instrument station
 * - Starting/stopping tracking mode
 * - Recording points
 */

export type InstrumentBrand = 'leica' | 'topcon' | 'trimble' | 'sokkia';

export interface MeasurementCommand {
  /** Human-readable description */
  description: string;
  /** Raw command string to send (with CRLF appended by sendCommand) */
  command: string;
  /** Expected response pattern (regex) */
  responsePattern?: RegExp;
  /** Timeout in ms */
  timeout?: number;
}

export interface StationSetup {
  pointName: string;
  easting: number;
  northing: number;
  elevation: number;
  instrumentHeight: number;
  backsightPointName?: string;
  backsightEasting?: number;
  backsightNorthing?: number;
  backsightElevation?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// LEICA — GeoCOM ASCII + GSI Commands
// ═══════════════════════════════════════════════════════════════════════

export const LEICA_COMMANDS = {
  /**
   * Trigger distance + angle measurement (standard)
   * GeoCOM: %R1Q,5002:1 — Measure and Record
   */
  measureAndRecord: (): MeasurementCommand => ({
    description: 'Measure and record (Leica GeoCOM)',
    command: '%R1Q,5002:1,0,0,0,0',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 30000,
  }),

  /**
   * Measure distance only (no recording)
   * GeoCOM: %R1Q,2008:1 — Measure Distance
   */
  measureDistance: (): MeasurementCommand => ({
    description: 'Measure distance only (Leica GeoCOM)',
    command: '%R1Q,2008:1,0',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 15000,
  }),

  /**
   * Get current angle readings
   * GeoCOM: %R1Q,2003 — Get Angle
   */
  getAngles: (): MeasurementCommand => ({
    description: 'Get current angles (Leica GeoCOM)',
    command: '%R1Q,2003:',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 5000,
  }),

  /**
   * Get coordinate of target point
   * GeoCOM: %R1Q,5003 — Get Coordinate
   */
  getCoordinate: (): MeasurementCommand => ({
    description: 'Get target coordinate (Leica GeoCOM)',
    command: '%R1Q,5003:1',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 15000,
  }),

  /**
   * Set target type to prism
   * GeoCOM: %R1Q,2022:1,0 — Set Prism Target
   */
  setPrismTarget: (prismConstant: number = 0): MeasurementCommand => ({
    description: 'Set prism target (Leica GeoCOM)',
    command: `%R1Q,2022:1,0,${prismConstant}`,
    responsePattern: /^%R1P,0,0:0/,
    timeout: 3000,
  }),

  /**
   * Set target type to reflectorless (RL)
   * GeoCOM: %R1Q,2022:0,0 — Set RL Target
   */
  setRLTarget: (): MeasurementCommand => ({
    description: 'Set reflectorless target (Leica GeoCOM)',
    command: '%R1Q,2022:0,0,0',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 3000,
  }),

  /**
   * Change to Face I (normal)
   * GeoCOM: %R1Q,2021:0 — Set Face I
   */
  setFaceI: (): MeasurementCommand => ({
    description: 'Set Face I (Leica GeoCOM)',
    command: '%R1Q,2021:0',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 3000,
  }),

  /**
   * Change to Face II
   * GeoCOM: %R1Q,2021:1 — Set Face II
   */
  setFaceII: (): MeasurementCommand => ({
    description: 'Set Face II (Leica GeoCOM)',
    command: '%R1Q,2021:1',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 3000,
  }),

  /**
   * Set instrument station (orientation)
   * GeoCOM: %R1Q,2023 — Set Station
   */
  setStation: (setup: StationSetup): MeasurementCommand => ({
    description: 'Set instrument station (Leica GeoCOM)',
    command: `%R1Q,2023:${setup.easting},${setup.northing},${setup.elevation},${setup.instrumentHeight}`,
    responsePattern: /^%R1P,0,0:0/,
    timeout: 5000,
  }),

  /**
   * Set orientation to backsight
   * GeoCOM: %R1Q,2024 — Set Orientation
   */
  setOrientation: (hzAngle: number): MeasurementCommand => ({
    description: 'Set orientation angle (Leica GeoCOM)',
    command: `%R1Q,2024:${hzAngle}`,
    responsePattern: /^%R1P,0,0:0/,
    timeout: 5000,
  }),

  /**
   * Start tracking mode (continuous measurement)
   * GeoCOM: %R1Q,2025:1 — Start Tracking
   */
  startTracking: (): MeasurementCommand => ({
    description: 'Start tracking mode (Leica GeoCOM)',
    command: '%R1Q,2025:1',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 5000,
  }),

  /**
   * Stop tracking mode
   * GeoCOM: %R1Q,2025:0 — Stop Tracking
   */
  stopTracking: (): MeasurementCommand => ({
    description: 'Stop tracking mode (Leica GeoCOM)',
    command: '%R1Q,2025:0',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 5000,
  }),

  /**
   * GSI command: Measure point and output GSI block
   * Works on older Leica instruments (TC, TCR, TPS series)
   */
  gsiMeasure: (pointNumber: number): MeasurementCommand => ({
    description: 'GSI measure point (Leica legacy)',
    command: `W${pointNumber.toString().padStart(4, '0')}`,
    responsePattern: /^W/,
    timeout: 15000,
  }),

  /**
   * Get instrument info
   * GeoCOM: %R1Q,5001 — Get Instrument Name
   */
  getInstrumentInfo: (): MeasurementCommand => ({
    description: 'Get instrument name (Leica GeoCOM)',
    command: '%R1Q,5001:',
    responsePattern: /^%R1P,0,0:0/,
    timeout: 5000,
  }),
};

// ═══════════════════════════════════════════════════════════════════════
// TOPCON — ASCII Command Protocol (RC-232 / ExtLink)
// ═══════════════════════════════════════════════════════════════════════

export const TOPCON_COMMANDS = {
  /**
   * Measure angle and distance
   * Command: MD<mode> — Measure Distance
   * Mode: 0=stop, 1=repeat, 2=single, 3=average, 4=tracking
   */
  measureAndRecord: (): MeasurementCommand => ({
    description: 'Measure angle + distance (Topcon)',
    command: 'MD2',
    responsePattern: /^MD/,
    timeout: 30000,
  }),

  /**
   * Single distance measurement
   */
  measureDistance: (): MeasurementCommand => ({
    description: 'Single distance measurement (Topcon)',
    command: 'MD2',
    responsePattern: /^MD/,
    timeout: 15000,
  }),

  /**
   * Get angle readings
   * Command: VA — Read Vertical/Horizonta angle
   */
  getAngles: (): MeasurementCommand => ({
    description: 'Read angles (Topcon)',
    command: 'VA',
    responsePattern: /^VA/,
    timeout: 5000,
  }),

  /**
   * Get coordinate of target
   * Command: CO — Coordinate Output
   */
  getCoordinate: (): MeasurementCommand => ({
    description: 'Get coordinate (Topcon)',
    command: 'CO',
    responsePattern: /^CO/,
    timeout: 15000,
  }),

  /**
   * Set target type to prism
   * Command: RM,1 — Reflector Mode: Prism
   */
  setPrismTarget: (prismConstant: number = 0): MeasurementCommand => ({
    description: 'Set prism target (Topcon)',
    command: `RM,1,${prismConstant}`,
    responsePattern: /^RM/,
    timeout: 3000,
  }),

  /**
   * Set target type to reflectorless (RL)
   * Command: RM,0 — Reflector Mode: Non-Prism
   */
  setRLTarget: (): MeasurementCommand => ({
    description: 'Set reflectorless target (Topcon)',
    command: 'RM,0,0',
    responsePattern: /^RM/,
    timeout: 3000,
  }),

  /**
   * Change to Face I
   * Command: PI — Position Index (Face I)
   */
  setFaceI: (): MeasurementCommand => ({
    description: 'Set Face I (Topcon)',
    command: 'PI',
    responsePattern: /^PI/,
    timeout: 3000,
  }),

  /**
   * Change to Face II
   * Command: PII — Position Index (Face II)
   */
  setFaceII: (): MeasurementCommand => ({
    description: 'Set Face II (Topcon)',
    command: 'PII',
    responsePattern: /^PII/,
    timeout: 3000,
  }),

  /**
   * Set instrument station
   * Command: SP,<easting>,<northing>,<elevation>,<IH>
   */
  setStation: (setup: StationSetup): MeasurementCommand => ({
    description: 'Set instrument station (Topcon)',
    command: `SP,${setup.easting},${setup.northing},${setup.elevation},${setup.instrumentHeight}`,
    responsePattern: /^SP/,
    timeout: 5000,
  }),

  /**
   * Set orientation / backsight
   * Command: SO,<azimuth> — Set Orientation
   */
  setOrientation: (hzAngle: number): MeasurementCommand => ({
    description: 'Set orientation angle (Topcon)',
    command: `SO,${hzAngle.toFixed(6)}`,
    responsePattern: /^SO/,
    timeout: 5000,
  }),

  /**
   * Start tracking mode
   * Command: MD4 — Tracking measurement
   */
  startTracking: (): MeasurementCommand => ({
    description: 'Start tracking mode (Topcon)',
    command: 'MD4',
    responsePattern: /^MD/,
    timeout: 5000,
  }),

  /**
   * Stop tracking mode
   * Command: MD0 — Stop measurement
   */
  stopTracking: (): MeasurementCommand => ({
    description: 'Stop tracking mode (Topcon)',
    command: 'MD0',
    responsePattern: /^MD/,
    timeout: 5000,
  }),

  /**
   * Get instrument info
   * Command: ID — Instrument ID
   */
  getInstrumentInfo: (): MeasurementCommand => ({
    description: 'Get instrument info (Topcon)',
    command: 'ID',
    responsePattern: /^ID/,
    timeout: 5000,
  }),
};

// ═══════════════════════════════════════════════════════════════════════
// TRIMBLE — Trimble Communications Protocol (TCP)
// ═══════════════════════════════════════════════════════════════════════

export const TRIMBLE_COMMANDS = {
  /**
   * Measure point (single measurement)
   * SSV: %M,1 — Measure point
   */
  measureAndRecord: (): MeasurementCommand => ({
    description: 'Measure and record (Trimble SSV)',
    command: '%M,1',
    responsePattern: /^%M/,
    timeout: 30000,
  }),

  /**
   * Measure distance only
   * SSV: %D,1 — Distance measurement
   */
  measureDistance: (): MeasurementCommand => ({
    description: 'Distance measurement (Trimble SSV)',
    command: '%D,1',
    responsePattern: /^%D/,
    timeout: 15000,
  }),

  /**
   * Get current angles
   * SSV: %A — Angle reading
   */
  getAngles: (): MeasurementCommand => ({
    description: 'Get angles (Trimble SSV)',
    command: '%A',
    responsePattern: /^%A/,
    timeout: 5000,
  }),

  /**
   * Get coordinate
   * SSV: %C,1 — Coordinate output
   */
  getCoordinate: (): MeasurementCommand => ({
    description: 'Get coordinate (Trimble SSV)',
    command: '%C,1',
    responsePattern: /^%C/,
    timeout: 15000,
  }),

  /**
   * Set prism target
   * SSV: %T,1,<prism_constant> — Target type prism
   */
  setPrismTarget: (prismConstant: number = 0): MeasurementCommand => ({
    description: 'Set prism target (Trimble SSV)',
    command: `%T,1,${prismConstant}`,
    responsePattern: /^%T/,
    timeout: 3000,
  }),

  /**
   * Set reflectorless target
   * SSV: %T,0 — Target type RL
   */
  setRLTarget: (): MeasurementCommand => ({
    description: 'Set reflectorless target (Trimble SSV)',
    command: '%T,0,0',
    responsePattern: /^%T/,
    timeout: 3000,
  }),

  /**
   * Set Face I
   * SSV: %F,1 — Face 1
   */
  setFaceI: (): MeasurementCommand => ({
    description: 'Set Face I (Trimble SSV)',
    command: '%F,1',
    responsePattern: /^%F/,
    timeout: 3000,
  }),

  /**
   * Set Face II
   * SSV: %F,2 — Face 2
   */
  setFaceII: (): MeasurementCommand => ({
    description: 'Set Face II (Trimble SSV)',
    command: '%F,2',
    responsePattern: /^%F/,
    timeout: 3000,
  }),

  /**
   * Set instrument station
   * SSV: %S,<easting>,<northing>,<elevation>,<IH>
   */
  setStation: (setup: StationSetup): MeasurementCommand => ({
    description: 'Set instrument station (Trimble SSV)',
    command: `%S,${setup.easting},${setup.northing},${setup.elevation},${setup.instrumentHeight}`,
    responsePattern: /^%S/,
    timeout: 5000,
  }),

  /**
   * Set orientation
   * SSV: %O,<azimuth> — Set orientation
   */
  setOrientation: (hzAngle: number): MeasurementCommand => ({
    description: 'Set orientation (Trimble SSV)',
    command: `%O,${hzAngle.toFixed(6)}`,
    responsePattern: /^%O/,
    timeout: 5000,
  }),

  /**
   * Start tracking mode
   * SSV: %K,1 — Start tracking
   */
  startTracking: (): MeasurementCommand => ({
    description: 'Start tracking (Trimble SSV)',
    command: '%K,1',
    responsePattern: /^%K/,
    timeout: 5000,
  }),

  /**
   * Stop tracking mode
   * SSV: %K,0 — Stop tracking
   */
  stopTracking: (): MeasurementCommand => ({
    description: 'Stop tracking (Trimble SSV)',
    command: '%K,0',
    responsePattern: /^%K/,
    timeout: 5000,
  }),

  /**
   * Get instrument info
   * SSV: %I — Instrument ID
   */
  getInstrumentInfo: (): MeasurementCommand => ({
    description: 'Get instrument info (Trimble SSV)',
    command: '%I',
    responsePattern: /^%I/,
    timeout: 5000,
  }),
};

// ═══════════════════════════════════════════════════════════════════════
// SOKKIA — SDR33 Command Protocol
// ═══════════════════════════════════════════════════════════════════════

export const SOKKIA_COMMANDS = {
  /**
   * Measure angle and distance
   * Command: 06/0 — Measure and Record
   */
  measureAndRecord: (): MeasurementCommand => ({
    description: 'Measure and record (Sokkia SDR)',
    command: '06/0',
    responsePattern: /^08\/|^02\/|^06\//,
    timeout: 30000,
  }),

  /**
   * Distance measurement only
   * Command: 04/0 — Distance measurement
   */
  measureDistance: (): MeasurementCommand => ({
    description: 'Distance measurement (Sokkia SDR)',
    command: '04/0',
    responsePattern: /^04\/|^02\//,
    timeout: 15000,
  }),

  /**
   * Get angle readings
   * Command: 03/0 — Angle reading
   */
  getAngles: (): MeasurementCommand => ({
    description: 'Get angles (Sokkia SDR)',
    command: '03/0',
    responsePattern: /^03\/|^02\//,
    timeout: 5000,
  }),

  /**
   * Get coordinate output
   * Command: 08/ — Coordinate output (from last measurement)
   */
  getCoordinate: (): MeasurementCommand => ({
    description: 'Get coordinate (Sokkia SDR)',
    command: '06/0',
    responsePattern: /^08\//,
    timeout: 15000,
  }),

  /**
   * Set prism target
   * Command: 10/1 — Prism mode
   */
  setPrismTarget: (prismConstant: number = 0): MeasurementCommand => ({
    description: 'Set prism target (Sokkia SDR)',
    command: `10/1,${prismConstant}`,
    responsePattern: /^10\//,
    timeout: 3000,
  }),

  /**
   * Set reflectorless target
   * Command: 10/0 — Non-prism mode
   */
  setRLTarget: (): MeasurementCommand => ({
    description: 'Set reflectorless target (Sokkia SDR)',
    command: '10/0,0',
    responsePattern: /^10\//,
    timeout: 3000,
  }),

  /**
   * Set Face I
   * Command: 11/1 — Face I
   */
  setFaceI: (): MeasurementCommand => ({
    description: 'Set Face I (Sokkia SDR)',
    command: '11/1',
    responsePattern: /^11\//,
    timeout: 3000,
  }),

  /**
   * Set Face II
   * Command: 11/2 — Face II
   */
  setFaceII: (): MeasurementCommand => ({
    description: 'Set Face II (Sokkia SDR)',
    command: '11/2',
    responsePattern: /^11\//,
    timeout: 3000,
  }),

  /**
   * Set instrument station
   * Command: 07/ — Station setup
   */
  setStation: (setup: StationSetup): MeasurementCommand => ({
    description: 'Set instrument station (Sokkia SDR)',
    command: `07/${setup.pointName},${setup.easting},${setup.northing},${setup.elevation},${setup.instrumentHeight}`,
    responsePattern: /^07\//,
    timeout: 5000,
  }),

  /**
   * Set orientation
   * Command: 09/ — Orientation
   */
  setOrientation: (hzAngle: number): MeasurementCommand => ({
    description: 'Set orientation (Sokkia SDR)',
    command: `09/${hzAngle.toFixed(6)}`,
    responsePattern: /^09\//,
    timeout: 5000,
  }),

  /**
   * Start tracking mode
   * Command: 06/1 — Tracking measurement
   */
  startTracking: (): MeasurementCommand => ({
    description: 'Start tracking (Sokkia SDR)',
    command: '06/1',
    responsePattern: /^06\//,
    timeout: 5000,
  }),

  /**
   * Stop tracking mode
   * Command: 06/0 — Stop
   */
  stopTracking: (): MeasurementCommand => ({
    description: 'Stop tracking (Sokkia SDR)',
    command: '06/0',
    responsePattern: /^06\//,
    timeout: 5000,
  }),

  /**
   * Get instrument info
   * Command: 01/ — Instrument ID
   */
  getInstrumentInfo: (): MeasurementCommand => ({
    description: 'Get instrument info (Sokkia SDR)',
    command: '01/',
    responsePattern: /^01\//,
    timeout: 5000,
  }),
};

// ═══════════════════════════════════════════════════════════════════════
// Unified Command Interface
// ═══════════════════════════════════════════════════════════════════════

export type CommandType =
  | 'measureAndRecord'
  | 'measureDistance'
  | 'getAngles'
  | 'getCoordinate'
  | 'setPrismTarget'
  | 'setRLTarget'
  | 'setFaceI'
  | 'setFaceII'
  | 'setStation'
  | 'setOrientation'
  | 'startTracking'
  | 'stopTracking'
  | 'getInstrumentInfo';

const COMMAND_SETS: Record<InstrumentBrand, Record<string, (...args: unknown[]) => MeasurementCommand>> = {
  leica: LEICA_COMMANDS as unknown as unknown as Record<string, (...args: unknown[]) => MeasurementCommand>,
  topcon: TOPCON_COMMANDS as unknown as Record<string, (...args: unknown[]) => MeasurementCommand>,
  trimble: TRIMBLE_COMMANDS as unknown as Record<string, (...args: unknown[]) => MeasurementCommand>,
  sokkia: SOKKIA_COMMANDS as unknown as Record<string, (...args: unknown[]) => MeasurementCommand>,
};

/**
 * Get the appropriate command for a brand and action
 */
export function getInstrumentCommand(
  brand: InstrumentBrand,
  commandType: CommandType,
  ...args: unknown[]
): MeasurementCommand {
  const commandSet = COMMAND_SETS[brand];
  if (!commandSet) {
    throw new Error(`Unknown instrument brand: ${brand}. Supported: leica, topcon, trimble, sokkia`);
  }

  const commandFactory = commandSet[commandType];
  if (!commandFactory) {
    throw new Error(`Command '${commandType}' not supported for ${brand}`);
  }

  return commandFactory(...(args as unknown[]));
}

/**
 * Detect brand from instrument preset key
 */
export function getBrandFromPreset(presetKey: string): InstrumentBrand {
  if (presetKey.startsWith('leica')) return 'leica';
  if (presetKey.startsWith('topcon')) return 'topcon';
  if (presetKey.startsWith('trimble')) return 'trimble';
  if (presetKey.startsWith('sokkia')) return 'sokkia';
  return 'leica'; // Default
}

/**
 * Get all available commands for a brand
 */
export function getAvailableCommands(brand: InstrumentBrand): string[] {
  return Object.keys(COMMAND_SETS[brand] || {});
}

/**
 * Brand display names and metadata
 */
export const BRAND_INFO: Record<InstrumentBrand, { name: string; models: string[]; protocol: string }> = {
  leica: {
    name: 'Leica Geosystems',
    models: ['TS02', 'TS06', 'TS09', 'TS11', 'TS15', 'TS16', 'TS60', 'Viva TS15', 'Viva TS16', 'Nova TS60'],
    protocol: 'GeoCOM ASCII / GSI-8 / GSI-16',
  },
  topcon: {
    name: 'Topcon',
    models: ['OS-101', 'OS-103', 'OS-105', 'DS-101', 'DS-103', 'DS-205', 'GM-101', 'GPT-3100', 'GTS-250'],
    protocol: 'TOPCON ASCII (RC-232 / ExtLink)',
  },
  trimble: {
    name: 'Trimble',
    models: ['S3', 'S5', 'S6', 'S7', 'S9', 'S9 HP', 'C5', 'M3', 'M5'],
    protocol: 'Trimble SSV / Trimble Communications Protocol',
  },
  sokkia: {
    name: 'Sokkia',
    models: ['CX-101', 'CX-103', 'CX-105', 'FX-101', 'FX-103', 'FX-105', 'SRX', 'SET'],
    protocol: 'SDR33 / SDR2x',
  },
};
