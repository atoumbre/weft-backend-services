/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { isRecord, optionalEnv, requireEnv } from '../src/utils'

let originalEnv: Record<string, string | undefined>

describe('utility functions', () => {
  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('requireEnv should return env value when set', () => {
    process.env.TEST_VAR = 'test_value'
    expect(requireEnv('TEST_VAR')).toBe('test_value')
  })

  it('requireEnv should throw when env value missing', () => {
    delete process.env.TEST_VAR
    expect(() => requireEnv('TEST_VAR')).toThrow('Missing required env var: TEST_VAR')
  })

  it('optionalEnv should return env value when set', () => {
    process.env.OPTIONAL_VAR = 'optional_value'
    expect(optionalEnv('OPTIONAL_VAR')).toBe('optional_value')
  })

  it('optionalEnv should return undefined when not set', () => {
    delete process.env.OPTIONAL_VAR
    expect(optionalEnv('OPTIONAL_VAR')).toBeUndefined()
  })

  it('optionalEnv should return undefined for empty string', () => {
    process.env.OPTIONAL_VAR = '   '
    expect(optionalEnv('OPTIONAL_VAR')).toBeUndefined()
  })

  it('isRecord should identify objects correctly', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ key: 'value' })).toBe(true)
    expect(isRecord(null)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord('string')).toBe(false)
    expect(isRecord(123)).toBe(false)
    expect(isRecord([])).toBe(true)
  })
})
