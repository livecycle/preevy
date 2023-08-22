import { describe, it, expect } from '@jest/globals'
import { formatFlagsToArgs } from './flags'

describe('formatFlagsToArgs', () => {
  describe('when given accepted characters', () => {
    it('text and numeric flags', () => {
      expect(formatFlagsToArgs({ test: 'abc' })).toEqual(['--test', 'abc'])
      expect(formatFlagsToArgs({ test: 5 })).toEqual(['--test', '5'])
    })
    it('support boolean flags', () => {
      expect(formatFlagsToArgs({ test: true })).toEqual(['--test'])
    })
    it('should support multiple variables', () => {
      expect(formatFlagsToArgs({ test: ['abc', 10] })).toEqual(['--test', 'abc', '--test', '10'])
    })
    it('should support nested variables', () => {
      expect(formatFlagsToArgs({ nested: { abc: 5, def: ['hello', 'world'] } })).toEqual(['--nested-abc', '5', '--nested-def', 'hello', '--nested-def', 'world'])
    })
    it('omit defaults based on spec', () => {
      expect(formatFlagsToArgs(
        { a: 5, b: true, c: 30, d: 50, e: 'test' },
        { a: { type: 'option', default: 5 }, b: { type: 'boolean', default: true }, c: { type: 'option' }, d: { type: 'option', default: 40 } },
      ))
        .toEqual(['--c', '30', '--d', '50', '--e', 'test'])
    })
    it('support inverted flags based on spec', () => {
      expect(formatFlagsToArgs(
        { a: false },
        { a: { type: 'boolean', default: true } },
      ))
        .toEqual(['--no-a'])
    })
  })
})
