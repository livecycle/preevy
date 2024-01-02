import z from 'zod'
import Dockerode from 'dockerode'
import { inspect } from 'util'
import { generateSchemaErrorMessage } from '@preevy/common'
import { PluginFactory } from '../../configuration/schema.js'
import { forwardsEmitter } from './forwards-emitter/index.js'
import { containersApi } from './api/index.js'
import { filteredClient } from './filtered-client.js'

const defaultSocketPath = '/var/run/docker.sock' as const
const defaultDebounceWait = 500 as const

const dockerFiltersSchema = z.object({
  label: z.array(z.string()),
}).partial()

const yargsOpts = {
  dockerSocketPath: {
    string: true,
    default: defaultSocketPath,
    description: 'Docker socket path',
  },
  dockerDebounceWait: {
    number: true,
    default: defaultDebounceWait,
  },
  dockerFilters: {
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
    default: [],
  },
} as const

export const dockerPlugin: PluginFactory<typeof yargsOpts> = {
  yargsOpts,
  init: async ({ dockerSocketPath: socketPath, dockerDebounceWait: debounceWait, dockerFilters: filters }) => {
    const docker = new Dockerode({ socketPath })

    return {
      forwardsEmitter: ({ log, tunnelNameResolver }) => forwardsEmitter({
        log,
        docker,
        debounceWait,
        filters,
        tunnelNameResolver,
      }),

      fastifyPlugin: async app => await app.register(containersApi, {
        dockerModem: docker.modem,
        dockerFilter: filteredClient({ docker, filters }),
        prefix: '/containers',
      }),
    }
  },
}
