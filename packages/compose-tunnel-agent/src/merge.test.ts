import { describe, test, expect } from '@jest/globals'
import { mergeDeep } from './merge.js'

describe('mergeDeep', () => {
  test('simple', () => {
    const result = mergeDeep({ a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  test('arrays', () => {
    const result = mergeDeep({ ar: [12] }, { ar: [34] })
    expect(result).toEqual({ ar: [12, 34] })
  })
})
