import { EventEmitter } from 'tseep'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { TimeoutError } from 'p-timeout'
import { onceWithTimeout } from './events'

describe('onceWithTimeout', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })
  afterAll(() => {
    jest.useRealTimers()
  })

  let emitter: EventEmitter<{ foo: () => void; error: (err: Error) => void }>
  beforeEach(() => {
    emitter = new EventEmitter()
  })

  describe('when no timeout occurs', () => {
    let p: Promise<void>
    beforeEach(() => {
      p = onceWithTimeout(emitter, 'foo', { milliseconds: 10 })
      emitter.emit('foo')
    })
    it('resolves to undefined', async () => {
      await expect(p).resolves.toBeUndefined()
    })
  })

  describe('when an error is emitted', () => {
    let p: Promise<void>
    const e = new Error('boom')
    beforeEach(() => {
      p = onceWithTimeout(emitter, 'foo', { milliseconds: 10 })
      emitter.emit('error', e)
    })
    it('rejects with the error', async () => {
      await expect(p).rejects.toThrow(e)
    })
  })

  describe('when a timeout occurs', () => {
    describe('when no fallback is specified', () => {
      let p: Promise<void>
      beforeEach(() => {
        p = onceWithTimeout(emitter, 'foo', { milliseconds: 10 })
        jest.advanceTimersByTime(10)
      })

      it('rejects with a TimeoutError', async () => {
        await expect(p).rejects.toThrow(TimeoutError)
        await expect(p).rejects.toThrow('timed out after 10ms')
      })
    })

    describe('when a fallback is specified', () => {
      let p: Promise<12>
      beforeEach(() => {
        p = onceWithTimeout(emitter, 'foo', { milliseconds: 10, fallback: async () => 12 as const })
        jest.advanceTimersByTime(10)
      })

      it('resolves with the fallback', async () => {
        await expect(p).resolves.toBe(12)
      })
    })
  })
})
