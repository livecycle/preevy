import { describe, it, expect } from '@jest/globals'
import { repeat } from 'lodash'
import { sanitizeLabel, sanitizeLabels } from './labels'

describe('labels', () => {
  describe('sanitizeLabel', () => {
    describe('when given accepted characters', () => {
      it('should not replace or prefix them', () => {
        expect(sanitizeLabel('1aBCde')).toBe('1aBCde')
      })
    })

    describe('when given banned characters', () => {
      it('should replace them', () => {
        expect(sanitizeLabel('-aBCd!e-')).toBe('a-aBCd-e-z')
      })
    })

    describe('when given a too long name', () => {
      const createLabel = () => sanitizeLabel(`!bLa-${repeat('a', 100)}`)
      it('should truncate it to the correct length', () => {
        const name = createLabel()
        expect(name).toHaveLength(63)
        expect(name).toMatch(/^a-bLa-a+-[a-zA-Z0-9]{4}$/)
      })

      it('should suffix it with a stable string', () => {
        const names = [createLabel(), createLabel()]
        expect(names[0]).toEqual(names[1])
      })
    })
  })

  describe('sanitizeLabels', () => {
    describe('when given accepted characters', () => {
      it('should not replace or prefix them', () => {
        expect(sanitizeLabels({ x: '1aBCde', y: '13' })).toEqual({ x: '1aBCde', y: '13' })
      })
    })

    describe('when given banned characters', () => {
      it('should replace them', () => {
        expect(sanitizeLabels({ x: '-aBCd!e-' })).toEqual({ x: 'a-aBCd-e-z' })
      })
    })
  })
})
