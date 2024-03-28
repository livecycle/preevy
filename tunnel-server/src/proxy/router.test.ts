import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import * as pino from 'pino'
import pinoPretty from 'pino-pretty'
import { IncomingMessage } from 'http'
import { Socket } from 'net'
import { TunnelFinder, proxyRouter } from './router.js'
import { ActiveTunnelStore } from '../tunnel-store/index.js'

const log = pino.pino<pino.Level>(
  { level: 'debug' },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  pinoPretty({ destination: pino.destination(process.stderr) }),
)

const mockFunction = <T extends (...args: never[]) => unknown>(): jest.MockedFunction<T> => (
  jest.fn() as unknown as jest.MockedFunction<T>
)

describe('proxy router', () => {
  const baseHostname = 'my-host.example.com'
  const router = proxyRouter({ log, baseHostname })
  let handler: undefined | TunnelFinder
  let get: ActiveTunnelStore['get']

  describe('when given a /proxy/<tunnel> path', () => {
    beforeEach(() => {
      const req = new IncomingMessage({} as Socket)
      req.headers.host = baseHostname
      req.url = '/proxy/my-tunnel2/my/path'
      handler = router(req)
      get = mockFunction<ActiveTunnelStore['get']>()
    })

    it('should find a route', () => {
      expect(handler).toBeTruthy()
    })

    it('should find a tunnel correctly', async () => {
      await handler?.({
        get,
      })
      expect(get).toHaveBeenCalledWith('my-tunnel2')
    })
  })

  describe('when given a tunnel in the hostname', () => {
    beforeEach(() => {
      const req = new IncomingMessage({} as Socket)
      req.headers.host = `my-tunnel.${baseHostname}`
      req.url = 'my/path'
      handler = router(req)
      get = mockFunction<ActiveTunnelStore['get']>()
    })

    it('should find a route', () => {
      expect(handler).toBeTruthy()
    })

    it('should find a tunnel correctly', async () => {
      await handler?.({
        get,
      })
      expect(get).toHaveBeenCalledWith('my-tunnel')
    })
  })

  describe('when given a request with the wrong hostname', () => {
    beforeEach(() => {
      const req = new IncomingMessage({} as Socket)
      req.headers.host = 'login.other-host.example.com'
      req.url = 'proxy/blabla'
      handler = router(req)
    })

    it('should not find a route', () => {
      expect(handler).toBeUndefined()
    })
  })

  describe('when given a request with the wrong path', () => {
    beforeEach(() => {
      const req = new IncomingMessage({} as Socket)
      req.headers.host = baseHostname
      req.url = 'notproxy/blabla'
      handler = router(req)
    })

    it('should not find a route', () => {
      expect(handler).toBeUndefined()
    })
  })
})
