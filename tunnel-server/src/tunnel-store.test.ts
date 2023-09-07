/* eslint-disable jest/no-standalone-expect */
import { it, describe, expect } from '@jest/globals'
import { createHash } from 'crypto'
import { activeTunnelStoreKey } from './tunnel-store'

describe('tunnel store key formatting', () => {
  it('should create the format {envId}-{clientId}', () => {
    const tunnelName = activeTunnelStoreKey('my-client', '/test-some-env')
    expect(tunnelName).toBe('test-some-env-my-client')
  })
  it('should handle long names', () => {
    const tunnelName = activeTunnelStoreKey('my-client', '/test-some-env-test-some-env-test-some-env-test-some-env')
    expect(tunnelName.length).toBe(63)
    expect(tunnelName.endsWith('my-client')).toBeTruthy()
  })

  describe('hashes which create digests with uppercase chars', () => {
    const tunnel = 'preevy_proxy-react-express-mysql-feature-ui-longname-with_other_long_features-12345678'
    const hash = createHash('md5').update(tunnel).digest('base64url').substring(0, 4)

    expect(hash).not.toBe(hash.toLowerCase())

    it('should handle long names with uppercase', () => {
      const tunnelName = activeTunnelStoreKey('my-client', tunnel)
      expect(tunnelName.length).toBe(63)
      expect(tunnelName.endsWith('my-client')).toBeTruthy()
      expect(tunnelName.toLowerCase()).toBe(tunnelName)
    })
  })

  it('should maintain uniqueness in long value', () => {
    const path = '/test-some-env-test-some-env-test-some-env-test-some-env'
    const tunnel1 = activeTunnelStoreKey('my-client', path)
    const tunnel2 = activeTunnelStoreKey('my-client', `${path}a`)
    expect(tunnel1.length).toEqual(tunnel2.length)
    expect(tunnel1.endsWith('my-client')).toBeTruthy()
    expect(tunnel2.endsWith('my-client')).toBeTruthy()
    expect(tunnel1).not.toEqual(tunnel2)
  })

  it('should only contain valid characters in path', () => {
    const path = '/$a§`dgbc``23§4sx'
    const tunnel1 = activeTunnelStoreKey('my-client', path)
    expect(tunnel1).toEqual('-a--dgbc--23-4sx-m2_7-my-client')
  })

  it('should throw error for invalid client id', () => {
    const invalidClient = 'ab`!@3'
    expect(() => activeTunnelStoreKey(invalidClient, 'test')).toThrow()
  })

  it('should maintain uniqueness in different characters', () => {
    const path = '/@'
    const path2 = '/$'
    const tunnel1 = activeTunnelStoreKey('my-client', path)
    const tunnel2 = activeTunnelStoreKey('my-client', path2)
    expect(tunnel1.length).toEqual(tunnel2.length)
    expect(tunnel1.endsWith('my-client')).toBeTruthy()
    expect(tunnel2.endsWith('my-client')).toBeTruthy()
    expect(tunnel1).not.toEqual(tunnel2)
  })
})
