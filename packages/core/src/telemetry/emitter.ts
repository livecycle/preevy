import os from 'os'
import fs from 'fs'
import crypto from 'crypto'
import stringifyModule from 'fast-safe-stringify'
import { debounce } from 'lodash-es'
import pLimit from 'p-limit'
import { inspect } from 'util'
import { memoizedMachineId } from './machine-id.js'
import { TelemetryEvent, TelemetryProperties, serializableEvent } from './events.js'
import { detectCiProvider } from '../ci-providers/index.js'

const stringify = stringifyModule.default

const newRunId = () => `ses_${crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`

const TELEMETRY_URL = 'https://telemetry.preevy.dev/v1/event'

export type GroupIdentityType = 'profile'

type IdentifyFunction = {
  (person: TelemetryProperties): void
  (id: string, person?: TelemetryProperties): void
}

export const telemetryEmitter = async ({ dataDir, version, debug, filename }: {
  dataDir: string
  version: string
  debug: number
  filename?: string
}) => {
  const machineId = await memoizedMachineId(dataDir)
  let distinctId = machineId
  const groupIdentities = {} as Record<GroupIdentityType, string>
  const pendingEvents: TelemetryEvent[] = []
  const runId = newRunId()
  const file = filename ? fs.createWriteStream(filename, 'utf-8') : undefined // await fs.promises.open(filename, 'a') : undefined
  let debounceDisabled = false
  const flushLimit = pLimit(1)
  const flush = async () => await flushLimit(async () => {
    if (!pendingEvents.length) {
      return
    }
    const batch = pendingEvents.map(serializableEvent)
    const body = stringify({ batch })
    file?.write(batch.map(event => `${stringify(event)}${os.EOL}`).join(''))
    pendingEvents.length = 0
    const response = await fetch(TELEMETRY_URL, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      redirect: 'follow',
      body,
      signal: AbortSignal.timeout(1500),
    }).catch(err => {
      if (debug) {
        process.stderr.write(`Error sending telemetry: ${inspect(err)}${os.EOL}`)
      }
    })
    if (response && !response.ok && debug) {
      process.stderr.write(`Error response from telemetry: ${response.status} ${response.statusText} ${response.url}${os.EOL}`)
    }
  })

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

  const group = ({ type: groupType, id: groupId } :
     {type: GroupIdentityType; id?: string}, props: TelemetryProperties = {}) => {
    if (groupId) {
      groupIdentities[groupType] = groupId
    }
    const currentGroupId = groupIdentities[groupType]
    if (currentGroupId) {
      pushEvent({
        event: '$groupidentify',
        timestamp: new Date(),
        distinct_id: distinctId,
        properties: {
          $group_type: groupType,
          $group_key: currentGroupId,
          $group_set: {
            name: currentGroupId,
            ...props,
          },
          ...commonProperties,
        },
      })
    }
  }

  const identify: IdentifyFunction = (...args) => {
    const [id, person] = (
      typeof args[0] === 'string' ? args : [undefined, args[0]]
    ) as [string, TelemetryProperties | undefined] | [undefined, TelemetryProperties]

    const shouldLinkToNewId = distinctId !== id

    if (shouldLinkToNewId || Object.keys(person ?? {}).length) {
      pushEvent({
        event: '$identify',
        timestamp: new Date(),
        distinct_id: id ?? distinctId,
        $set: person,
        properties: {
          ...(shouldLinkToNewId && id) ? { $anon_distinct_id: distinctId } : {},
          ...commonProperties,
        },
      })
    }

    if (id) {
      distinctId = id
    }
  }

  return ({
    identify,
    group,
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
    unref: () => {
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
  identify: () => undefined,
  group: () => undefined,
  capture: async () => undefined,
  unref: async () => undefined,
  setProps: () => undefined,
  flush: async () => undefined,
}
