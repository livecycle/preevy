import { describe, beforeEach, it, expect, afterEach, jest, beforeAll } from '@jest/globals'
import crypto, { KeyObject } from 'node:crypto'
import http from 'http'
import fs from 'fs'
import events from 'node:events'
import path from 'path'
import * as pino from 'pino'
import pinoPretty from 'pino-pretty'
import { promisify } from 'node:util'
import { request, Dispatcher } from 'undici'
import { calculateJwkThumbprintUri, exportJWK, JWTPayload, SignJWT } from 'jose'
import { createApp } from './index.js'
import { SessionStore } from '../session.js'
import { Claims, cliIdentityProvider, jwtAuthenticator, saasIdentityProvider } from '../auth.js'
import { ActiveTunnel, ActiveTunnelStore } from '../tunnel-store/index.js'
import { EntryWatcher } from '../memory-store.js'
import { authHintQueryParam, proxy } from '../proxy/index.js'
import { calcLoginUrl } from './urls.js'

const mockFunction = <T extends (...args: never[]) => unknown>(): jest.MockedFunction<T> => (
  jest.fn() as unknown as jest.MockedFunction<T>
)

type MockInterface<T extends {}> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown
    ? jest.MockedFunction<T[K]>
    : T[K]
}

const generateKeyPair = promisify(crypto.generateKeyPair)

const genKey = async () => {
  const kp = await generateKeyPair('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const publicKey = crypto.createPublicKey(kp.publicKey)
  const publicKeyThumbprint = await calculateJwkThumbprintUri(await exportJWK(publicKey))

  return { publicKey, publicKeyThumbprint, privateKey: crypto.createPrivateKey(kp.privateKey) }
}

type Key = Awaited<ReturnType<typeof genKey>>

const jwtGenerator = async (
  { publicKey, privateKey }: { publicKey: KeyObject; privateKey: KeyObject },
  claims: JWTPayload = {},
) => {
  const thumbprint = await calculateJwkThumbprintUri(await exportJWK(publicKey))

  return await (new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setIssuer(`preevy://${thumbprint}`)
    .sign(privateKey))
}

describe('app', () => {
  let saasKey: Key
  let envKey: Key

  beforeAll(async () => {
    saasKey = await genKey()
    envKey = await genKey()
  })

  let app: Awaited<ReturnType<typeof createApp>>
  let baseAppUrl: string
  type SessionStoreStore = ReturnType<SessionStore<Claims>>
  let sessionStoreStore: MockInterface<SessionStoreStore>
  let sessionStore: jest.MockedFunction<SessionStore<Claims>>
  let activeTunnelStore: MockInterface<Pick<ActiveTunnelStore, 'get' | 'getByPkThumbprint'>>
  let user: Claims | undefined

  const log = pino.pino<pino.Level>(
    { level: 'debug' },

    // @ts-ignore
    pinoPretty({ destination: pino.destination(process.stderr) }),
  )

  beforeEach(async () => {
    user = undefined
    sessionStoreStore = {
      save: mockFunction<SessionStoreStore['save']>(),
      set: mockFunction<SessionStoreStore['set']>(),
      get user() { return user },
    }
    sessionStore = mockFunction<SessionStore<Claims>>().mockReturnValue(sessionStoreStore)
    activeTunnelStore = {
      get: mockFunction<ActiveTunnelStore['get']>(),
      getByPkThumbprint: mockFunction<ActiveTunnelStore['getByPkThumbprint']>(),
    }

    const authFactory = (
      { publicKey, publicKeyThumbprint }: { publicKey: KeyObject; publicKeyThumbprint: string },
    ) => jwtAuthenticator(publicKeyThumbprint, [
      cliIdentityProvider(publicKey, publicKeyThumbprint),
      saasIdentityProvider('saas.livecycle.example', saasKey.publicKey),
    ])

    const baseUrl = new URL('http://base.livecycle.example')

    app = await createApp({
      sessionStore,
      activeTunnelStore,
      baseUrl,
      log,
      saasBaseUrl: new URL('http://saas.livecycle.example'),
      authFactory,
      proxy: proxy({
        activeTunnelStore,
        log,
        sessionStore,
        baseHostname: baseUrl.hostname,
        authFactory,
        loginUrl: ({ env, returnPath }) => calcLoginUrl({ baseUrl, env, returnPath }),
      }),
    })

    baseAppUrl = await app.listen({ host: '127.0.0.1', port: 0 })
  })

  afterEach(async () => {
    await app.close()
  })

  describe('login', () => {
    describe('when not given the required query params', () => {
      let response: Dispatcher.ResponseData
      beforeEach(async () => {
        response = await request(`${baseAppUrl}/login`, { headers: { host: 'api.base.livecycle.example' } })
      })

      it('should return status code 400', () => {
        expect(response.statusCode).toBe(400)
      })
    })

    describe('when given an env and a returnPath that does not start with /', () => {
      let response: Dispatcher.ResponseData
      beforeEach(async () => {
        response = await request(`${baseAppUrl}/login?env=myenv&returnPath=bla`, { headers: { host: 'api.base.livecycle.example' } })
      })

      it('should return status code 400', () => {
        expect(response.statusCode).toBe(400)
      })
    })

    describe('when given a nonexistent env and a valid returnPath', () => {
      let response: Dispatcher.ResponseData
      beforeEach(async () => {
        response = await request(`${baseAppUrl}/login?env=myenv&returnPath=/bla`, { headers: { host: 'api.base.livecycle.example' } })
      })

      it('should return status code 404', async () => {
        expect(response.statusCode).toBe(404)
      })

      it('should return a descriptive message in the body JSON', async () => {
        expect(await response.body.json()).toHaveProperty('message', 'Unknown envId: myenv')
      })
    })

    describe('when given an existing env and a valid returnPath and no session or authorization header', () => {
      let response: Dispatcher.ResponseData
      beforeEach(async () => {
        activeTunnelStore.get.mockImplementation(async () => ({
          value: {
            publicKeyThumbprint: envKey.publicKeyThumbprint,
          } as ActiveTunnel,
          watcher: undefined as unknown as EntryWatcher,
        }))
        response = await request(`${baseAppUrl}/login?env=myenv&returnPath=/bla`, { headers: { host: 'api.base.livecycle.example' } })
      })

      it('should return a redirect to the saas login page', async () => {
        expect(response.statusCode).toBe(302)
        const locationHeader = response.headers.location
        expect(locationHeader).toMatch('http://saas.livecycle.example/api/auth/login')
        const redirectUrl = new URL(locationHeader as string)
        const redirectBackUrlStr = redirectUrl.searchParams.get('redirectTo')
        expect(redirectBackUrlStr).toBeDefined()
        expect(redirectBackUrlStr).toMatch('http://auth.base.livecycle.example/login')
        const redirectBackUrl = new URL(redirectBackUrlStr as string)
        expect(redirectBackUrl.searchParams.get('env')).toBe('myenv')
        expect(redirectBackUrl.searchParams.get('returnPath')).toBe('/bla')
      })
    })

    describe('when given an existing env and a valid returnPath and a session cookie', () => {
      let response: Dispatcher.ResponseData
      beforeEach(async () => {
        activeTunnelStore.get.mockImplementation(async () => ({
          value: {
            publicKeyThumbprint: envKey.publicKeyThumbprint,
          } as ActiveTunnel,
          watcher: undefined as unknown as EntryWatcher,
        }))
        user = { } as Claims
        response = await request(`${baseAppUrl}/login?env=myenv&returnPath=${encodeURIComponent(`/bla?foo=bar&${authHintQueryParam}=basic`)}`, { headers: { host: 'api.base.livecycle.example' } })
      })

      it('should return a redirect to the env page', async () => {
        expect(response.statusCode).toBe(302)
        const locationHeader = response.headers.location
        expect(locationHeader).toBe(`http://myenv.base.livecycle.example/bla?foo=bar&${authHintQueryParam}=basic`)
      })
    })
  })

  const setupOriginServer = (
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void = (_req, res) => { res.end('hello') },
  ) => {
    let originServer: http.Server
    let lastReq: http.IncomingMessage
    let tmpDir: string
    let listenPath: string

    beforeEach(async () => {
      tmpDir = await fs.promises.mkdtemp('test-originServer')
      listenPath = path.join(tmpDir, 'listen')
      originServer = http.createServer((req, res) => {
        lastReq = req
        handler(req, res)
      })
      originServer.listen({ path: listenPath })
      await events.once(originServer, 'listening')
    })
    afterEach(async () => {
      originServer.close()
      await events.once(originServer, 'close')
      await fs.promises.rm(tmpDir, { recursive: true, force: true })
    })

    return {
      get lastReq() { return lastReq },
      get listenPath() { return listenPath },
    }
  }

  describe('proxy', () => {
    let response: Dispatcher.ResponseData
    let activeTunnel: ActiveTunnel
    beforeEach(async () => {
      activeTunnelStore.get.mockImplementation(async () => ({
        value: activeTunnel,
        watcher: undefined as unknown as EntryWatcher,
      }))
    })

    describe('private tunnel', () => {
      describe('with no session', () => {
        beforeEach(async () => {
          activeTunnel = {
            access: 'private',
            hostname: 'my-tunnel',
            publicKeyThumbprint: envKey.publicKeyThumbprint,
            publicKey: envKey.publicKey,
          } as ActiveTunnel
        })

        describe('without basic auth hint', () => {
          beforeEach(async () => {
            response = await request(`${baseAppUrl}/bla`, { headers: { host: 'my-tunnel.base.livecycle.example' } })
          })

          it('should return a redirect to the login page', async () => {
            expect(response.statusCode).toBe(307)
            const locationHeader = response.headers.location
            expect(locationHeader).toBe('http://auth.base.livecycle.example/login?env=my-tunnel&returnPath=%2Fbla')
          })
        })

        describe('with basic auth hint', () => {
          beforeEach(async () => {
            response = await request(`${baseAppUrl}/bla?${authHintQueryParam}=basic`, { headers: { host: 'my-tunnel.base.livecycle.example' } })
          })

          it('should return an unauthorized status with basic auth header', async () => {
            expect(response.statusCode).toBe(401)
            expect(response.headers['www-authenticate']).toBe('Basic realm="Secure Area"')
          })
        })

        describe('with basic auth', () => {
          const originServer = setupOriginServer()
          let jwt: string
          beforeEach(async () => {
            activeTunnel.target = originServer.listenPath
            sessionStoreStore.set.mockImplementation(u => { user = u })
            jwt = await jwtGenerator(envKey)
          })

          describe('from a non-browser', () => {
            beforeEach(async () => {
              response = await request(`${baseAppUrl}/bla`, {
                headers: {
                  host: 'my-tunnel.base.livecycle.example',
                  authorization: `Basic ${Buffer.from(`x-preevy-profile-key:${jwt}`).toString('base64')}`,
                },
              })
            })

            it('should return the origin response', async () => {
              expect(response.statusCode).toBe(200)
              expect(await response.body.text()).toBe('hello')
            })
          })

          describe('from a browser', () => {
            beforeEach(async () => {
              response = await request(`${baseAppUrl}/bla?${authHintQueryParam}=basic`, {
                headers: {
                  host: 'my-tunnel.base.livecycle.example',
                  'user-agent': 'chrome',
                  authorization: `Basic ${Buffer.from(`x-preevy-profile-key:${jwt}`).toString('base64')}`,
                },
              })
            })

            it('should return a redirect to the login page', async () => {
              expect(response.statusCode).toBe(307)
              const locationHeader = response.headers.location
              expect(locationHeader).toBe('http://auth.base.livecycle.example/login?env=my-tunnel&returnPath=%2Fbla')
            })
          })
        })

        describe('with bearer token', () => {
          const originServer = setupOriginServer()
          beforeEach(async () => {
            activeTunnel.target = originServer.listenPath
            sessionStoreStore.set.mockImplementation(u => { user = u })
            const jwt = await jwtGenerator(envKey)
            response = await request(`${baseAppUrl}/bla`, {
              headers: {
                host: 'my-tunnel.base.livecycle.example',
                authorization: `Bearer ${jwt}`,
              },
            })
          })

          it('should return the origin response', async () => {
            expect(response.statusCode).toBe(200)
            expect(await response.body.text()).toBe('hello')
          })
        })
      })

      describe('with a session', () => {
        const originServer = setupOriginServer()
        beforeEach(async () => {
          user = { role: 'admin' } as Claims
          activeTunnel = {
            access: 'private',
            hostname: 'my-tunnel',
            target: originServer.listenPath,
          } as ActiveTunnel
          response = await request(`${baseAppUrl}/bla`, { headers: { host: 'my-tunnel.base.livecycle.example' } })
        })

        it('should return the origin response', async () => {
          expect(response.statusCode).toBe(200)
          expect(await response.body.text()).toBe('hello')
        })
      })
    })

    describe('public tunnel', () => {
      describe('with no session', () => {
        const originServer = setupOriginServer()
        beforeEach(async () => {
          activeTunnel = {
            access: 'public',
            hostname: 'my-tunnel',
            target: originServer.listenPath,
          } as ActiveTunnel
          response = await request(`${baseAppUrl}/bla`, { headers: { host: 'my-tunnel.base.livecycle.example' } })
        })

        it('should return the origin response', async () => {
          expect(response.statusCode).toBe(200)
          expect(await response.body.text()).toBe('hello')
        })
      })
    })
  })
})
