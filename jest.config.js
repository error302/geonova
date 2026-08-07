module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  coverageProvider: 'v8',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: false,
        noEmit: false,
      },
    }],
    // OpenLayers v10 ships ESM-only ("type": "module"); transpile its source
    // with babel so real ol classes load under jest's CJS runtime. Matches the
    // ol whitelist already present in transformIgnorePatterns below.
    'node_modules[\\\\/]ol[\\\\/].*\\.js$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
  transformIgnorePatterns: [
    // The lookbehind is deliberate: ol v10's nested ESM deps (rbush, earcut,
    // quickselect) live under node_modules/ol/node_modules/, and without
    // (?<!ol/) the whitelist would re-ignore (and leave untransformed) those
    // inner paths. Only ol's hoisted top-level ESM deps (pbf, geotiff,
    // jsonparse, topojson-client) are not covered — extend the transform key
    // and whitelist when a test first needs those modules.
    '(?<!ol/)node_modules/(?!(delaunator|robust-predicates|ol|ol/)/)',
  ],
  moduleNameMapper: {
    '^@/lib/workers/tinWorkerUrl$': '<rootDir>/tests/__mocks__/tinWorkerUrl.ts',
    '^delaunator$': '<rootDir>/tests/__mocks__/delaunator.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: [
    // AUDIT FIX (M11, 2026-07-02): Expanded coverage collection from
    // just src/lib/engineering/ to include all critical lib modules.
    'src/lib/engineering/*.ts',
    'src/lib/engine/**/*.ts',
    'src/lib/survey/**/*.ts',
    'src/lib/geodesy/**/*.ts',
    'src/lib/validation/**/*.ts',
    'src/lib/auth/**/*.ts',
    'src/lib/offline/**/*.ts',
    'src/lib/audit/**/*.ts',
    'src/lib/security/**/*.ts',
    'src/lib/workers/**/*.ts',
    // Excludes
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    // AUDIT FIX (2026-07-05): Ratcheted thresholds — second bump after
    // adding tests for security/rateLimit, auth/ownership, validation/
    // surveyData, engine/chainageCalculator, engine/computationalAccuracy,
    // and validation/versionedEntities.
    //
    // Current baseline (2026-07-05):
    //   Statements: 53.87% → set threshold to 50% (catch regressions >4pp)
    //   Branches:    75.12% → set threshold to 70% (catch regressions >5pp)
    //   Functions:   70.26% → set threshold to 65% (catch regressions >5pp)
    //   Lines:       53.87% → set threshold to 50%
    //
    // RATCHET PLAN: as coverage improves, raise these thresholds.
    // Goal: 80% across the board by end of Q4 2026.
    // Tracking: see worklog entries dated 2026-07-05.
    //
    // Next priorities for coverage improvement (in priority order):
    //   1. src/lib/auth/requireAuth.ts (0% → currently exposed via API routes only)
    //   2. src/lib/auth/session.ts (0% → NextAuth session helpers)
    //   3. src/lib/enterprise/auditTrail.ts (0% → audit log query builder)
    //   4. src/lib/engineering/crossSectionVolume.ts (0% → earthworks math)
    //   5. src/lib/engineering/cutFillEngine.ts (0% → earthworks math)
    //   6. src/lib/engineering/deformationTracker.ts (0% → monitoring)
    //   7. src/lib/engineering/gcpOptimizer.ts (0% → GNSS control)
    //   8. src/lib/survey/traverse/least-squares.ts (0% → LSQ adjustment)
    global: {
      branches: 70,
      functions: 65,
      lines: 50,
      statements: 50,
    },
    './src/lib/engineering/': {
      branches: 55,
      functions: 55,
      lines: 55,
      statements: 55,
    },
  },
}
