import { describe, it, expect, beforeEach } from '@jest/globals'
import { repeat } from 'lodash'
import { alphabets, randomString, truncatePrefix, truncateWithHash } from './strings'

describe('strings', () => {
  describe('truncateWithHash', () => {
    it('should leave short strings as is', () => {
      expect(truncateWithHash('abc', 3)).toBe('abc')
    })

    it('should add a stable hash to long strings', () => {
      expect(truncateWithHash(repeat('a', 10), 9)).toBe('aaaa-4JyA')
    })
  })

  describe('truncatePrefix', () => {
    const prefix = 'prefix'
    const suffix = 'suffix'

    it('should not truncate the prefix if, combined with suffix, it does not exceed the max length', () => {
      expect(truncatePrefix(prefix, suffix, prefix.length + suffix.length + 1)).toBe(`${prefix}-${suffix}`)
    })

    it('should not truncate the prefix if, combined with suffix, it exceeds the max length', () => {
      expect(truncatePrefix(prefix, suffix, prefix.length + suffix.length)).toBe(`${prefix.substring(0, prefix.length - 1)}-${suffix}`)
    })
  })

  describe('randomString', () => {
    describe('non-bound function', () => {
      let s: string
      const createRandomString = () => randomString('abc', 10)

      beforeEach(() => {
        s = createRandomString()
      })

      it('should create a string with the specified length', () => {
        expect(s).toHaveLength(10)
      })

      it('should create a string from the specified alphabet', () => {
        expect(s).toMatch(/^[a-c]{10}$/)
      })

      it('should hopefully not create the same string twice', () => {
        expect(s).not.toEqual(createRandomString())
      })
    })

    describe('alphabets', () => {
      Object.entries(alphabets).forEach(([name, alphabet]) => {
        it(`should create a string with the ${name} alphabet`, () => {
          expect(randomString[name as keyof typeof alphabets](10)).toMatch(new RegExp(`^[${alphabet}]{10}$`))
        })
      })
    })
  })
})
