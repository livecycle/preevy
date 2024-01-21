import z from 'zod'
import Dockerode from 'dockerode'
import { inspect } from 'util'
import { generateSchemaErrorMessage } from '@preevy/common'
import { Plugin, PluginFactory } from '../../plugin-definition.js'
import { forwardsEmitter } from './forwards-emitter/index.js'
import { containersApi } from './api/index.js'
import { filteredClient } from './filtered-client.js'
import { runDockerMachineStatusCommand } from './machine-status-command.js'
import { containerToForwards } from './forwards-emitter/services.js'

const defaultSocketPath = '/var/run/docker.sock' as const
const defaultDebounceWait = 500 as const

const dockerFiltersSchema = z.object({
  label: z.array(z.string()),
}).partial()

const group = 'Docker plugin'

export const yargsOpts = {
  'docker-socket-path': {
    group,
    string: true,
    default: defaultSocketPath,
    description: 'Docker socket path',
  },
  'docker-debounce-wait': {
    group,
    number: true,
    default: defaultDebounceWait,
  },
  'docker-filters': {
    group,
    coerce: (o: unknown) => {
      if (typeof o !== 'object') {
        throw new Error('Invalid docker filters - use dot notation to specify an object')
      }
      const result = dockerFiltersSchema.safeParse(o)
      if (!result.success) {
        // eslint-disable-next-line no-underscore-dangle
        throw new Error(`Invalid docker filters: ${inspect(o)}: ${generateSchemaErrorMessage(result.error)}`, { cause: result.error })
      }
      return result.data
    },
  },
  'docker-auto-forward': {
    group,
    description: 'Automatically forward containers based on the specified filters',
    boolean: true,
    default: false,
  },
} as const

export const dockerPlugin: PluginFactory<typeof yargsOpts, Plugin & { docker: Dockerode }> = {
  yargsOpts,
  init: async (
    { dockerSocketPath: socketPath, dockerDebounceWait: debounceWait, dockerFilters: filters, dockerAutoForward },
    { log },
  ) => {
    const docker = new Dockerode({ socketPath })

    return {
      forwardsEmitter: dockerAutoForward ? ({ tunnelNameResolver }) => forwardsEmitter({
        log,
        docker,
        debounceWait,
        filters,
        containerToForwards: containerToForwards({ tunnelNameResolver }),
      }) : undefined,

      fastifyPlugin: async app => await app.register(containersApi, {
        dockerModem: docker.modem,
        dockerFilter: filteredClient({ docker, filters }),
        prefix: '/containers',
      }),

      machineStatusCommands: {
        docker: runDockerMachineStatusCommand({ docker, log }),
      },

      docker,
      [Symbol.asyncDispose]: async () => undefined,
    }
  },
}
