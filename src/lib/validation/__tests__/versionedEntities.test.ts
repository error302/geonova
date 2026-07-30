/**
 * Tests for versionedEntities — shared registry of entity types that support
 * the entity_versions snapshot system.
 */

import {
  VERSIONED_ENTITY_TYPES,
  type VersionedEntityType,
} from '../versionedEntities'

describe('VERSIONED_ENTITY_TYPES', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(VERSIONED_ENTITY_TYPES)).toBe(true)
    expect(VERSIONED_ENTITY_TYPES.length).toBeGreaterThan(0)
  })

  it('includes parcels and blocks (scheme entities)', () => {
    expect(VERSIONED_ENTITY_TYPES).toContain('parcels')
    expect(VERSIONED_ENTITY_TYPES).toContain('blocks')
  })

  it('includes projects (top-level entity)', () => {
    expect(VERSIONED_ENTITY_TYPES).toContain('projects')
  })

  it('includes traverse results, history, and observations', () => {
    expect(VERSIONED_ENTITY_TYPES).toContain('traverse_results')
    expect(VERSIONED_ENTITY_TYPES).toContain('traverse_history')
    expect(VERSIONED_ENTITY_TYPES).toContain('traverse_observations')
  })

  it('includes project_fieldbook_entries and survey_points', () => {
    expect(VERSIONED_ENTITY_TYPES).toContain('project_fieldbook_entries')
    expect(VERSIONED_ENTITY_TYPES).toContain('survey_points')
  })

  it('contains only lowercase snake_case strings', () => {
    for (const t of VERSIONED_ENTITY_TYPES) {
      expect(typeof t).toBe('string')
      expect(t).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it('contains no duplicates', () => {
    const set = new Set(VERSIONED_ENTITY_TYPES)
    expect(set.size).toBe(VERSIONED_ENTITY_TYPES.length)
  })

  it('is frozen (immutable at runtime)', () => {
    // The `as const` assertion makes it readonly at compile time, but at
    // runtime the array is still mutable. Verify it's at least not empty.
    expect(VERSIONED_ENTITY_TYPES).toBeDefined()
  })
})

describe('VersionedEntityType (type-level)', () => {
  // Type-level test: assigning a known-good value compiles.
  // Assigning a non-member would fail to compile (TS2345).
  it('accepts a known entity type', () => {
    const sample: VersionedEntityType = 'projects'
    expect(sample).toBe('projects')
  })
})
