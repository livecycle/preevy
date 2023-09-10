import { describe, expect, it, beforeEach } from '@jest/globals'
import { ArrayMap, arrayMap } from './array-map'

describe('arrayMap', () => {
  let a: ArrayMap<string, { x: number }>
  const expectedValues = [{ x: 12 }, { x: 13 }] as const
  beforeEach(() => {
    a = arrayMap()
    a.add('foo', expectedValues[0])
    a.add('foo', expectedValues[1])
  })

  describe('when the key does not exist', () => {
    it('returns undefined', () => {
      expect(arrayMap().get('bar')).toBeUndefined()
    })
  })

  describe('when the key exists', () => {
    let values: { x: number }[] | undefined
    beforeEach(() => {
      values = a.get('foo')
    })
    it('returns the values', () => {
      expect(values).toBeDefined()
      expect(values).toHaveLength(2)
      expect(values).toContain(expectedValues[0])
      expect(values).toContain(expectedValues[1])
    })

    describe('when delete is called with a predicate that returns false for everything', () => {
      beforeEach(() => {
        a.delete('foo', () => false)
        values = a.get('foo')
      })
      it('does not delete the values', () => {
        expect(values).toBeDefined()
        expect(values).toHaveLength(2)
        expect(values).toContain(expectedValues[0])
        expect(values).toContain(expectedValues[1])
      })
    })

    describe('when delete is called with a predicate that returns true for everything', () => {
      beforeEach(() => {
        a.delete('foo', () => true)
        values = a.get('foo')
      })
      it('deletes the values', () => {
        expect(values).toBeUndefined()
      })
    })

    describe('when delete is called with a predicate that returns true for a specific value', () => {
      beforeEach(() => {
        a.delete('foo', ({ x }) => x === expectedValues[0].x)
        values = a.get('foo')
      })

      it('deletes the specific value', () => {
        expect(values).toBeDefined()
        expect(values).toHaveLength(1)
        expect(values).not.toContain(expectedValues[0])
        expect(values).toContain(expectedValues[1])
      })
    })
  })
})
