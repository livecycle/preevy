import z from 'zod'
import Dockerode from 'dockerode'
import { inspect } from 'util'
import { generateSchemaErrorMessage } from '@preevy/common'
import { PluginFactory } from '../../configuration/plugins.js'
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
  dockerSocketPath: {
    group,
    string: true,
    default: defaultSocketPath,
    description: 'Docker socket path',
  },
  dockerDebounceWait: {
    group,
    number: true,
    default: defaultDebounceWait,
  },
  dockerFilters: {
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
} as const

export const dockerPlugin: PluginFactory<typeof yargsOpts> = {
  yargsOpts,
  init: async ({ dockerSocketPath: socketPath, dockerDebounceWait: debounceWait, dockerFilters: filters }, { log }) => {
    const docker = new Dockerode({ socketPath })

    return {
      forwardsEmitter: ({ tunnelNameResolver }) => forwardsEmitter({
        log,
        docker,
        debounceWait,
        filters,
        containerToForwards: containerToForwards({ tunnelNameResolver }),
      }),

      fastifyPlugin: async app => await app.register(containersApi, {
        dockerModem: docker.modem,
        dockerFilter: filteredClient({ docker, filters }),
        prefix: '/containers',
      }),

      machineStatusCommands: {
        docker: runDockerMachineStatusCommand({ docker, log }),
      },
    }
  },
}
