import { AddressInfo } from 'node:net'
import { describe, expect, beforeAll, afterAll, jest, it } from '@jest/globals'
import { ChildProcess, spawn, exec } from 'child_process'
import { pino } from 'pino'
import pinoPrettyModule from 'pino-pretty'
import Dockerode from 'dockerode'
import { inspect, promisify } from 'node:util'
import waitForExpectModule from 'wait-for-expect'
import WebSocket from 'ws'
import stripAnsi from 'strip-ansi'
import { createApp } from './index.js'
import { filteredClient } from '../docker/index.js'
import { SshState } from '../ssh/index.js'
import { COMPOSE_PROJECT_LABEL } from '../docker/labels.js'
import { composeProjectFilters } from '../docker/filters.js'

const PinoPretty = pinoPrettyModule.default

const waitForExpect = waitForExpectModule.default
const TEST_COMPOSE_PROJECT = 'my-project'

const setupDockerContainer = () => {
  let dockerProcess: ChildProcess
  let containerName: string
  let output: Buffer[]
  jest.setTimeout(20000)

  beforeAll(() => {
    containerName = `test-docker-proxy-${Math.random().toString(36).substring(2, 9)}`
    output = []
    dockerProcess = spawn(
      'docker',
      [
        ...`run --rm --name ${containerName} --label ${COMPOSE_PROJECT_LABEL}=${TEST_COMPOSE_PROJECT} busybox sh -c`.split(' '),
        'while true; do echo "hello stdout"; >&2 echo "hello stderr"; sleep 0.1; done',
      ]
    )
    dockerProcess.stdout?.on('data', data => { output.push(data) })
    dockerProcess.stderr?.on('data', data => { output.push(data) })
    return new Promise<void>((resolve, reject) => {
      dockerProcess.stdout?.once('data', () => { resolve() })
      dockerProcess.once('error', reject)
      dockerProcess.once('exit', (code, signal) => {
        const outStr = Buffer.concat(output).toString('utf-8')
        reject(new Error(`docker exited with code ${code} and signal ${signal}: ${outStr}`))
      })
    })
  })

  afterAll(async () => {
    dockerProcess.kill()
    await promisify(exec)(`docker rm -f ${containerName}`)
  })

  return {
    containerName: () => containerName,
  }
}

const setupApiServer = () => {
  const log = pino({
    level: 'debug',
  }, PinoPretty({ destination: pino.destination(process.stderr) }))

  let app: Awaited<ReturnType<typeof createApp>>
  let serverBaseUrl: string

  beforeAll(async () => {
    const docker = new Dockerode()
    app = await createApp({
      log,
      docker,
      dockerFilter: filteredClient({
        docker,
        filters: composeProjectFilters({ composeProject: TEST_COMPOSE_PROJECT })
      }),
      composeModelPath: '',
      currentSshState: () => Promise.resolve({} as unknown as SshState),
    })
    await app.listen({ port: 0 })
    const { port } = app.server.address() as AddressInfo
    serverBaseUrl = `localhost:${port}`
  })

  afterAll(async () => {
    await app.close()
  })

  return {
    serverBaseUrl: () => serverBaseUrl,
  }
}

const fetchJson = async (...args: Parameters<typeof fetch>) => {
  const r = await fetch(...args)
  if (!r.ok) {
    throw new Error(`Fetch ${inspect(args)} failed: ${r.status} ${r.statusText}: ${await r.text()}`)
  }
  return await r.json()
}

type OpenWebSocket = {
  ws: WebSocket
  receivedBuffers: Buffer[]
  close: () => Promise<void>
  send: (data: string | Buffer) => Promise<void>
}

const openWebSocket = (url: string) => new Promise<OpenWebSocket>((resolve, reject) => {
  const receivedBuffers: Buffer[] = []
  new WebSocket(url)
    .on('error', reject)
    .on('message', data => {
      if (Buffer.isBuffer(data)) {
        receivedBuffers.push(data)
      } else if (Array.isArray(data)) {
        receivedBuffers.push(...data)
      } else {
        receivedBuffers.push(Buffer.from(data))
      }
    })
    .on('open', function onOpen() {
      resolve({
        ws: this,
        receivedBuffers,
        close: () => new Promise<void>(resolveClose => {
          this.close()
          this.once('close', () => { resolveClose() })
        }),
        send: promisify(this.send.bind(this)),
      })
    })
})

describe('docker api', () => {
  const { containerName } = setupDockerContainer()
  const { serverBaseUrl } = setupApiServer()

  const waitForContainerId = async () => {
    let containerId = ''
    await waitForExpect(async () => {
      const containers = await fetchJson(`http://${serverBaseUrl()}/containers`) as { Id: string; Names: string[] }[]
      const container = containers.find(({ Names: names }) => names.includes(`/${containerName()}`))
      expect(container).toBeDefined()
      containerId = container?.Id as string
    }, 3000, 100)
    return containerId
  }

  describe('exec', () => {
    let containerId: string

    beforeAll(async () => {
      containerId = await waitForContainerId()
    })

    describe('tty=true', () => {
      it('should communicate via websocket', async () => {
        const { receivedBuffers, send, close } = await openWebSocket(`ws://${serverBaseUrl()}/containers/${containerId}/exec`)
        await waitForExpect(() => expect(receivedBuffers.length).toBeGreaterThan(0))
        await send('ls \n')
        await waitForExpect(() => {
          const received = stripAnsi(Buffer.concat(receivedBuffers).toString('utf-8'))
          expect(received).toMatch(/#/)
          expect(received).toMatch(/ls/)
          expect(received).toMatch(/bin/)
        })
        await close()
      })
    })

    describe('tty=false', () => {
      it('should communicate via websocket', async () => {
        const { receivedBuffers, send, close } = await openWebSocket(`ws://${serverBaseUrl()}/containers/${containerId}/exec`)
        await waitForExpect(async () => {
          await send('ls\n')
          const received = Buffer.concat(receivedBuffers).toString('utf-8')
          expect(received).toContain('bin')
        })
        await close()
      })
    })
  })

  describe('logs', () => {
    let containerId: string
    beforeAll(async () => {
      containerId = await waitForContainerId()
    })

    const logStreams = ['stdout', 'stderr'] as const
    type LogStream = typeof logStreams[number]

    const testStream = (...s: LogStream[]) => {
      describe(`${s.join(' and ')}`, () => {
        it(`should show the ${s.join(' and ')} logs via websocket`, async () => {
          const { receivedBuffers, close } = await openWebSocket(`ws://${serverBaseUrl()}/containers/${containerId}/logs?${s.map(st => `${st}=true`).join('&')}`)
          await waitForExpect(() => expect(receivedBuffers.length).toBeGreaterThan(0))
          const length1 = receivedBuffers.length
          await waitForExpect(() => {
            const received = Buffer.concat(receivedBuffers).toString('utf-8')
            s.forEach(st => {
              expect(received).toContain(`hello ${st}`)
            })
            logStreams.filter(st => !s.includes(st)).forEach(st => {
              expect(received).not.toContain(`hello ${st}`)
            })
          })
          await waitForExpect(() => {
            expect(receivedBuffers.length).toBeGreaterThan(length1)
          })
          await close()
        })
      })
    }

    testStream('stdout')
    testStream('stderr')
    testStream('stdout', 'stderr')

    describe('timestamps', () => {
      it('should show the logs with a timestamp', async () => {
        const { receivedBuffers, close } = await openWebSocket(`ws://${serverBaseUrl()}/containers/${containerId}/logs?stdout=true&timestamps=true`)
        await waitForExpect(() => expect(receivedBuffers.length).toBeGreaterThan(0))
        const received = Buffer.concat(receivedBuffers).toString('utf-8')
        expect(received).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d*Z/)
        await close()
      })
    })
  })
})
