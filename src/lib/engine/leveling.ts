/**
 * Calculation standard: N.N. Basak — Surveying and Levelling
 * - No intermediate rounding
 * - Full floating point precision throughout
 * - Round only at final display layer
 * - Bearings: WCB 0-360° clockwise from North
 */

// GeoNova Engine - Leveling calculations

import { LevelingResult, LevelingReading } from './types';

export interface LevelingInput {
  readings: Array<{
    station: string;
    bs?: number;
    is?: number;
    fs?: number;
  }>;
  openingRL: number;
  closingRL?: number;
  method: 'rise_and_fall' | 'height_of_collimation';
  distanceKm?: number;
}

export function riseAndFall(input: LevelingInput): LevelingResult {
  const { readings, openingRL, closingRL, distanceKm = 1 } = input;
  
  const results: LevelingReading[] = [];
  
  // Starting point
  let currentRL = openingRL;
  results.push({
    station: 'BM',
    reducedLevel: currentRL
  });
  
  // Process each reading
  let sumBS = 0;
  let sumFS = 0;
  let sumRise = 0;
  let sumFall = 0;
  
  for (const reading of readings) {
    const result: LevelingReading = {
      station: reading.station
    };
    
    if (reading.bs !== undefined && reading.bs !== null) {
      result.bs = reading.bs;
      sumBS += reading.bs;
    }
    
    if (reading.is !== undefined && reading.is !== null) {
      result.is = reading.is;
      // IS doesn't change the chain, just computes RL
      result.reducedLevel = currentRL - reading.is;
    }
    
    if (reading.fs !== undefined && reading.fs !== null) {
      result.fs = reading.fs;
      sumFS += reading.fs;
      
      // Calculate rise/fall from previous RL
      const rise = currentRL - reading.fs;
      
      if (rise >= 0) {
        result.rise = rise;
        result.fall = 0;
        sumRise += rise;
      } else {
        result.rise = 0;
        result.fall = Math.abs(rise);
        sumFall += Math.abs(rise);
      }
      
      currentRL = reading.fs;
      result.reducedLevel = currentRL;
    }
    
    results.push(result);
  }
  
  // Calculate misclosure
  let misclosure = 0;
  let arithmeticCheck = false;
  
  if (closingRL !== undefined) {
    misclosure = currentRL - closingRL;
    arithmeticCheck = Math.abs(sumBS - sumFS - (sumRise - sumFall)) < 0.001;
  } else {
    arithmeticCheck = Math.abs(sumBS - sumFS) < 0.001;
  }
  
  // Calculate allowable misclosure (ordinary leveling: ±12√K mm)
  const allowableMisclosure = 12 * Math.sqrt(distanceKm) / 1000;
  const isAcceptable = Math.abs(misclosure) <= allowableMisclosure;
  
  // Adjust RLs if within tolerance
  if (isAcceptable && misclosure !== 0) {
    const numReadings = results.length;
    for (let i = 1; i < results.length; i++) {
      const adjustment = (i / (numReadings - 1)) * misclosure;
      const rl = results[i].reducedLevel;
      if (rl !== undefined) {
        results[i].adjustedRL = rl - adjustment;
      }
    }
  }
  
  return {
    readings: results,
    misclosure,
    arithmeticCheck,
    allowableMisclosure,
    isAcceptable,
    method: 'rise_and_fall'
  };
}

export function heightOfCollimation(input: LevelingInput): LevelingResult {
  const { readings, openingRL, distanceKm = 1 } = input;
  
  const results: LevelingReading[] = [];
  
  // First reading must be a BS to establish HI
  if (!readings[0]?.bs) {
    return {
      readings: [],
      misclosure: 0,
      arithmeticCheck: false,
      allowableMisclosure: 0,
      isAcceptable: false,
      method: 'height_of_collimation'
    };
  }
  
  // Calculate HI from first BS
  let hi = openingRL + readings[0].bs;
  
  const firstResult: LevelingReading = {
    station: readings[0].station,
    bs: readings[0].bs,
    reducedLevel: openingRL
  };
  results.push(firstResult);
  
  let sumBS = readings[0].bs;
  let sumFS = 0;
  
  for (let i = 1; i < readings.length; i++) {
    const reading = readings[i];
    const result: LevelingReading = {
      station: reading.station
    };
    
    if (reading.bs !== undefined && reading.bs !== null) {
      result.bs = reading.bs;
      hi = hi + reading.bs;
      sumBS += reading.bs;
      result.reducedLevel = hi - reading.bs;
    }
    
    if (reading.fs !== undefined && reading.fs !== null) {
      result.fs = reading.fs;
      sumFS += reading.fs;
      result.reducedLevel = hi - reading.fs;
    }
    
    if (reading.is !== undefined && reading.is !== null) {
      result.is = reading.is;
      result.reducedLevel = hi - reading.is;
    }
    
    results.push(result);
  }
  
  // Arithmetic check
  const arithmeticCheck = Math.abs(sumBS - sumFS) < 0.001;
  
  return {
    readings: results,
    misclosure: 0,
    arithmeticCheck,
    allowableMisclosure: 0,
    isAcceptable: true,
    method: 'height_of_collimation'
  };
}
