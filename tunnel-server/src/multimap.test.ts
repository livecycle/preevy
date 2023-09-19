import { describe, expect, it, beforeEach } from '@jest/globals'
import { MultiMap, multimap } from './multimap'

describe('multimap', () => {
  type ObjType = { x: number }
  let a: MultiMap<string, ObjType>
  const expectedValues = [{ x: 12 }, { x: 13 }] as const
  beforeEach(() => {
    a = multimap()
    a.add('foo', expectedValues[0])
    a.add('foo', expectedValues[1])
  })

  describe('when the key does not exist', () => {
    it('returns undefined', () => {
      expect(multimap().get('bar')).toBeUndefined()
    })
  })

  describe('when the key exists', () => {
    let values: readonly ObjType[] | undefined
    beforeEach(() => {
      values = a.get('foo')
    })
    it('returns the values', () => {
      expect(values).toBeDefined()
      expect(values).toHaveLength(2)
      expect(values).toContain(expectedValues[0])
      expect(values).toContain(expectedValues[1])
    })

    describe('when the returned array is mutated', () => {
      beforeEach(() => {
        (values as ObjType[]).push({ x: 14 })
      })
      it('does not affect the multimap', () => {
        expect(a.get('foo')).toHaveLength(2)
      })
    })

    describe('when delete is called with a predicate that returns false for everything', () => {
      let deleteReturn: boolean
      beforeEach(() => {
        deleteReturn = a.delete('foo', () => false)
        values = a.get('foo')
      })

      it('returns false', () => {
        expect(deleteReturn).toBe(false)
      })

      it('does not delete the values', () => {
        expect(values).toBeDefined()
        expect(values).toHaveLength(2)
        expect(values).toContain(expectedValues[0])
        expect(values).toContain(expectedValues[1])
      })
    })

    describe('when delete is called with a predicate that returns true for everything', () => {
      let deleteReturn: boolean
      beforeEach(() => {
        deleteReturn = a.delete('foo', () => true)
        values = a.get('foo')
      })

      it('returns true', () => {
        expect(deleteReturn).toBe(true)
      })

      it('deletes the values', () => {
        expect(values).toBeUndefined()
      })
    })

    describe('when delete is called with a predicate that returns true for a specific value', () => {
      let deleteReturn: boolean
      beforeEach(() => {
        deleteReturn = a.delete('foo', ({ x }) => x === expectedValues[0].x)
        values = a.get('foo')
      })

      it('returns true', () => {
        expect(deleteReturn).toBe(true)
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
