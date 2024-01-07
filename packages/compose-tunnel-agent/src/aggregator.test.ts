import { describe, test, expect } from '@jest/globals'
import { aggregator } from './aggregator.js'

describe('aggregator', () => {
  type Obj = { key: string; value: number }

  test('distinct objects', () => {
    const agg = aggregator<Obj>(o => o.key)
    const o1 = { key: 'a', value: 1 }
    const o2 = { key: 'b', value: 2 }
    expect(agg('s1', [o1])).toEqual([o1])
    expect(agg('s2', [o2])).toEqual([o1, o2])
  })

  test('duplicate objects', () => {
    const agg = aggregator<Obj>(o => o.key)
    const o1 = { key: 'a', value: 1 }
    const o2 = { key: 'a', value: 2 }
    expect(agg('s1', [o1])).toEqual([o1])
    expect(agg('s2', [o2])).toEqual([o2])
    expect(agg('s2', [])).toEqual([o1])
  })
})
