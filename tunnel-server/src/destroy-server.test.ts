/* eslint-disable jest/no-standalone-expect */
import net from 'node:net'
import events from 'node:events'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { promisify } from 'node:util'
import waitForExpect from 'wait-for-expect'
import { createDestroy } from './destroy-server.js'

describe('createDestroy', () => {
  let server: net.Server
  let port: number
  let serverSockets: net.Socket[]
  let destroy: (cb?: () => void) => void
  let closed: boolean
  beforeEach(async () => {
    serverSockets = []
    server = net.createServer(socket => {
      serverSockets.push(socket)
      socket.on('data', data => socket.write(data))
      socket.on('error', () => undefined)
      socket.unref()
    })
    destroy = createDestroy(server)
    server.listen({ port: 0, host: '127.0.0.1' })
    server.unref()
    closed = false
    server.once('close', () => { closed = true })
    await events.once(server, 'listening')
    port = (server.address() as net.AddressInfo).port
  })

  afterEach(async () => {
    if (server.listening) {
      server.close()
    }
  })

  describe('when no sockets are connected', () => {
    describe('and only close is called', () => {
      beforeEach(() => {
        server.close()
      })

      it('emits the close event immediately', async () => {
        await waitForExpect.default(async () => {
          expect(closed).toBe(true)
        }, 1000, 100)
      })
    })
  })

  describe('when sockets are connected', () => {
    let socket: net.Socket
    beforeEach(async () => {
      socket = net.connect({ host: '127.0.0.1', port, keepAlive: true, noDelay: true })
      socket.on('error', () => undefined)
      await events.once(socket, 'connect')
      socket.unref()

      // flood socket
      do {
        // no-op
      } while (socket.write('hello'))
      await promisify(socket.write.bind(socket))('hello')
    })

    describe('and only close is called', () => {
      beforeEach(async () => {
        expect(closed).toBe(false)
        server.close()
        await new Promise<void>(resolve => { setTimeout(resolve, 100) })
      })

      it('does not emit the close event immediately', async () => {
        expect(closed).toBe(false)
      })
    })

    describe('and destroy is called', () => {
      beforeEach(async () => {
        expect(closed).toBe(false)
        destroy()
      })

      it('emits the close event immediately', async () => {
        await waitForExpect.default(async () => {
          expect(closed).toBe(true)
        }, 1000, 100)
      })
    })
  })
})
