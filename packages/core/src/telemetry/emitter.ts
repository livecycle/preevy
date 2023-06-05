import os from 'os'
import crypto from 'crypto'
import stringify from 'fast-safe-stringify'
import fetch from 'node-fetch'
import { debounce } from 'lodash'
import { memoizedMachineId } from './machine-id'
import { TelemetryEvent, TelemetryProperties, serializableEvent } from './events'
import { detectCiProvider } from '../ci-providers'

const newRunId = () => `ses_${crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`

const TELEMETRY_URL = 'https://telemetry.preevy.dev/v1/event'

export type GroupIdentityType = 'profile'

type IdentifyFunction = {
  (props: TelemetryProperties): void
  (identityType: GroupIdentityType, props: TelemetryProperties): void
  (identityType: GroupIdentityType, id: string, props: TelemetryProperties): void
}

export const telemetryEmitter = async ({ dataDir, version, debug }: {
  dataDir: string
  version: string
  debug: number
}) => {
  const machineId = await memoizedMachineId(dataDir)
  const groupIdentities = {} as Record<GroupIdentityType, string>
  const pendingEvents: TelemetryEvent[] = []
  const runId = newRunId()
  let debounceDisabled = false

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

  const debouncedFlush = debounce(flush, 3000, { maxWait: 8000 })

  const pushEvent = (event: TelemetryEvent) => {
    pendingEvents.push(event)
    if (debounceDisabled) {
      void flush()
    } else {
      void debouncedFlush()
    }
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

  const identify: IdentifyFunction = (...args: unknown[]) => {
    let groupIdentityType: GroupIdentityType | undefined; let groupId: string | undefined; let
      props: TelemetryProperties
    if (typeof args[2] === undefined && typeof args[1] === undefined) {
      props = args[0] as TelemetryProperties
    } else if (typeof args[2] === undefined) {
      groupIdentityType = args[0] as GroupIdentityType
      groupId = groupIdentities[groupIdentityType]
      props = args[1] as TelemetryProperties
    } else {
      [groupIdentityType, groupId, props] = args as [GroupIdentityType, string, TelemetryProperties ]
      groupIdentities[groupIdentityType] = groupId
    }

    if (groupIdentityType && groupId) {
      pushEvent({
        event: '$groupidentify',
        timestamp: new Date(),
        distinct_id: machineId,
        properties: {
          $group_type: groupIdentityType,
          $group_key: groupId,
          $group_set: {
            name: groupId,
            ...props,
          },
          ...commonProperties,
        },
      })
    } else if (Object.keys(props ?? {}).length) {
      pushEvent({
        event: '$identify',
        timestamp: new Date(),
        distinct_id: machineId,
        $set: props,
        properties: {
          ...commonProperties,
        },
      })
    }
  }

  return ({
    identify,
    capture: (event: string, props: TelemetryProperties) => {
      pushEvent({
        event,
        timestamp: new Date(),
        distinct_id: machineId,
        properties: {
          $groups: groupIdentities,
          ...commonProperties,
          ...props,
        },
      })
    },
    setProps: (props: TelemetryProperties) => {
      Object.assign(commonProperties, props)
    },
    // For making sure we're not keeping the process running due to debounce.
    // Flush is not called as there could be other captures afterwards such as exit event.
    release: () => {
      debounceDisabled = true
      debouncedFlush.cancel()
    },
    async flush() {
      debouncedFlush.cancel()
      await flush()
    },
  })
}

export type TelemetryEmitter = Awaited<ReturnType<typeof telemetryEmitter>>

export const nullTelemetryEmitter: TelemetryEmitter = {
  identify: async () => undefined,
  capture: async () => undefined,
  release: async () => undefined,
  setProps: () => undefined,
  flush: async () => undefined,
}
