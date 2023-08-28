import { describe, it, expect, beforeEach } from '@jest/globals'
import { editUrl } from './url'

describe('url', () => {
  describe('editUrl', () => {
    let baseUrl: URL
    beforeEach(() => {
      baseUrl = new URL('http://example.com/?x=12&y=13')
    })

    describe('when given a hostname', () => {
      it('should override the hostname', () => {
        expect(editUrl(baseUrl, { hostname: 'other.org' }).toJSON()).toEqual(new URL('http://other.org/?x=12&y=13').toJSON())
      })
    })

    describe('when given query params', () => {
      it('should override the given query params', () => {
        expect(editUrl(baseUrl, { queryParams: { x: '15', z: '16' } }).toJSON()).toEqual(new URL('http://example.com/?x=15&z=16&y=13').toJSON())
      })
    })

    describe('when given username and password', () => {
      it('should override the username and password', () => {
        expect(editUrl(baseUrl, { username: 'user1', password: 'hunter2' }).toJSON()).toEqual(new URL('http://user1:hunter2@example.com/?x=12&y=13').toJSON())
      })
    })
  })
})
