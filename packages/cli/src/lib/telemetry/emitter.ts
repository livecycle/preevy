import os from 'os'
import crypto from 'crypto'
import stringify from 'fast-safe-stringify'
import fetch from 'node-fetch'
import { debounce } from 'lodash'
import { memoizedMachineId } from './machine-id'
import { TelemetryEvent, TelemetryProperties, serializableEvent } from './events'
import { detectCiProvider } from '../ci-providers'

const newRunId = () => `ses_${crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`

const TELEMETRY_URL = 'https://preevy-telemetry.livecycle.run/v1/event'
const FLUSH_INTERVAL = 5000

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

    const response = await fetch(TELEMETRY_URL, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      redirect: 'follow',
      body: stringify({ batch: pendingEvents.map(serializableEvent) }),
    })

    if (!response.ok && debug) {
      process.stderr.write(`Error sending telemetry: ${response.status} ${response.statusText} ${response.url}${os.EOL}`)
    }
  }

  const debouncedFlush = debounce(flush, FLUSH_INTERVAL)

  const pushEvent = (event: TelemetryEvent) => {
    pendingEvents.push(event)
    void debouncedFlush()
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
    machineId,
    runId,
  }

  return ({
    identify: (id: string, person: TelemetryProperties) => {
      if (id !== currentId) {
        pushEvent({
          event: '$create_alias',
          timestamp: new Date(),
          distinct_id: id,
          properties: {
            distinct_id: id,
            alias: currentId,
            ...commonProperties,
          },
        })
      }
      if (currentId === runId || Object.keys(person).length) {
        pushEvent({
          event: '$identify',
          timestamp: new Date(),
          distinct_id: id,
          $set: person,
          ...currentId === runId ? { $anon_distinct_id: currentId } : {},
          properties: {
            ...commonProperties,
          },
        })
      }
      currentId = id
    },
    capture: (event: string, props: TelemetryProperties) => {
      pendingEvents.push({
        event,
        timestamp: new Date(),
        distinct_id: currentId,
        properties: {
          ...commonProperties,
          ...props,
        },
      })
    },
    flush: () => {
      debouncedFlush.cancel()
      return flush()
    },
  })
}

export type TelemetryEmitter = Awaited<ReturnType<typeof telemetryEmitter>>

export const nullTelemetryEmitter: TelemetryEmitter = {
  identify: async () => undefined,
  capture: async () => undefined,
  flush: async () => undefined,
}
