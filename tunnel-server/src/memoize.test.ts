import { afterAll, beforeAll, beforeEach, describe, it, expect, jest } from '@jest/globals'
import { memoizeForDuration } from './memoize.js'

describe('memoizeForDuration', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })
  afterAll(() => {
    jest.useRealTimers()
  })

  let fn: jest.Mock<() => number>
  let memoized: () => number

  beforeEach(() => {
    fn = jest.fn(() => 12)
    memoized = memoizeForDuration(fn, 1000)
  })

  describe('before the first call', () => {
    it('does not call the specified function', () => {
      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe('on the first call', () => {
    let v: number
    beforeEach(() => {
      v = memoized()
    })
    it('calls the specified function', () => {
      expect(fn).toHaveBeenCalledTimes(1)
    })
    it('returns the memoized value', () => {
      expect(v).toBe(12)
    })

    describe('on the second call, when the expiry duration has not passed', () => {
      beforeEach(() => {
        jest.advanceTimersByTime(999)
        v = memoized()
      })
      it('does not call the specified function again', () => {
        expect(fn).toHaveBeenCalledTimes(1)
      })
      it('returns the memoized value', () => {
        expect(v).toBe(12)
      })
    })

    describe('on the second call, when the expiry duration has passed', () => {
      beforeEach(() => {
        jest.advanceTimersByTime(1000)
        v = memoized()
      })
      it('calls the specified function again', () => {
        expect(fn).toHaveBeenCalledTimes(2)
      })
      it('returns the memoized value', () => {
        expect(v).toBe(12)
      })
    })
  })
})
