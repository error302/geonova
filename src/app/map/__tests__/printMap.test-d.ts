/**
 * Type-level regression test: printMap signature lock.
 * Ensures `overrides` parameter is typed as Partial<PrintOptions> and prevents `any` from creeping back in.
 */
import type { MapContextValue } from '@/app/map/MapReactContext'
import type { PrintOptions } from '@/hooks/usePrint'

// 1. Assert printMap signature on MapContextValue
type ExtractedPrintMap = MapContextValue['printMap']

// 2. Type test helper: checkIfTypeIsAny
type IsAny<T> = 0 extends 1 & T ? true : false

// Ensure parameter type is not `any`
type ParamType = Parameters<ExtractedPrintMap>[0]
type ParamIsAny = IsAny<ParamType>

// Compile-time assertions:
const _paramIsNotAny: ParamIsAny = false

// Verify exact assignment compatibility with Partial<PrintOptions> | undefined
const _testSignature: (overrides?: Partial<PrintOptions>) => Promise<void> =
  ({} as MapContextValue).printMap

export {}
