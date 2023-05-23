import os from 'os'
import crypto from 'crypto'
import stringify from 'fast-safe-stringify'
import fetch from 'node-fetch'
import { throttle } from 'lodash'
import { memoizedMachineId } from './machine-id'
import { TelemetryEvent, TelemetryProperties, serializableEvent } from './events'
import { detectCiProvider } from '../ci-providers'

const newRunId = () => `ses_${crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`

const TELEMETRY_URL = 'https://preevy-telemetry.livecycle.run/v1/event'
const FLUSH_INTERVAL = 5000

type IdentifyFunction = {
  (person: TelemetryProperties): void
  (id: string, person?: TelemetryProperties): void
}

export const telemetryEmitter = async ({ dataDir, version, debug }: {
  dataDir: string
  version: string
  debug: number
}) => {
  const machineId = await memoizedMachineId(dataDir)

  const pendingEvents: TelemetryEvent[] = []
  const runId = newRunId()
  let currentId = runId

  const flush = async () => {
    if (!pendingEvents.length) {
      return
    }

    const body = stringify({ batch: pendingEvents.map(serializableEvent) })
    pendingEvents.length = 0

    const response = await fetch(TELEMETRY_URL, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      redirect: 'follow',
      body,
    })

    if (!response.ok && debug) {
      process.stderr.write(`Error sending telemetry: ${response.status} ${response.statusText} ${response.url}${os.EOL}`)
    }
  }

  const throttledFlush = throttle(flush, FLUSH_INTERVAL)

  const pushEvent = (event: TelemetryEvent) => {
    pendingEvents.push(event)
    void throttledFlush()
  }

  const ciProvider = detectCiProvider()

  const commonProperties = {
    platform: os.platform(),
    arch: os.arch(),
    versions: {
      node: process.versions.node,
      v8: process.versions.v8,
      openssl: process.versions.openssl,
      os: os.version(),
      os_release: os.release(),
    },
    is_ci: Boolean(process.env.CI),

    // is_ci_pr: whether this CI run is for a PR or a branch sync
    // use case: determine whether we should change envId calculation to be based on PR number and not just branch
    is_ci_pr: Boolean(ciProvider?.pullRequestNumber()),

    // use case: determine which CI integration to develop first
    ci_provider: ciProvider?.name,

    version,
    shell: os.userInfo().shell,
    $device_id: machineId,
    run_id: runId,
  }

  const identify: IdentifyFunction = (...args) => {
    const [id, person] = (
      typeof args[0] === 'string' ? args : [undefined, args[0]]
    ) as [string, TelemetryProperties | undefined] | [undefined, TelemetryProperties]

    const isCurrentIdAnonymous = currentId === runId

    if (isCurrentIdAnonymous || Object.keys(person ?? {}).length) {
      pushEvent({
        event: '$identify',
        timestamp: new Date(),
        distinct_id: id ?? currentId,
        $set: person,
        properties: {
          ...(isCurrentIdAnonymous && id) ? { $anon_distinct_id: currentId } : {},
          ...commonProperties,
        },
      })
    }

    if (id) {
      currentId = id
    }
  }

  return ({
    identify,
    capture: (event: string, props: TelemetryProperties) => {
      pushEvent({
        event,
        timestamp: new Date(),
        distinct_id: currentId,
        properties: {
          ...commonProperties,
          ...props,
        },
      })
    },
    setProps: (props: TelemetryProperties) => {
      Object.assign(commonProperties, props)
    },
    flush: () => {
      throttledFlush.cancel()
      return flush()
    },
  })
}

export type TelemetryEmitter = Awaited<ReturnType<typeof telemetryEmitter>>

export const nullTelemetryEmitter: TelemetryEmitter = {
  identify: async () => undefined,
  capture: async () => undefined,
  setProps: () => undefined,
  flush: async () => undefined,
}
