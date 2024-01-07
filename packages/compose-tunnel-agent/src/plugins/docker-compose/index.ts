import fs from 'fs'
import { omit } from 'lodash-es'
import { PluginFactory } from '../../configuration/plugins.js'
import { dockerPlugin as dockerPluginFactory } from '../docker/index.js'
import { COMPOSE_PROJECT_LABEL } from './forwards-emitter/labels.js'
import { DockerApiFilter } from '../docker/filters.js'
import { forwardsEmitter } from '../docker/forwards-emitter/index.js'
import { composeContainerToForwards } from './forwards-emitter/index.js'

const group = 'Docker Compose plugin'

const yargsOpts = {
  dockerComposeProject: {
    group,
    string: true,
    description: 'Docker Compose project name',
    demandOption: true,
  },
  composeFile: {
    group,
    string: true,
    description: 'Path to compose file',
  },
  ...omit<typeof dockerPluginFactory.yargsOpts, 'dockerFilters'>(dockerPluginFactory.yargsOpts, 'dockerFilters'),
} as const

export const dockerComposeFilters = (composeProject: string): DockerApiFilter => ({
  label: [`${COMPOSE_PROJECT_LABEL}=${composeProject}`],
})

export const dockerComposePlugin: PluginFactory<typeof yargsOpts> = {
  yargsOpts,
  init: async ({ dockerComposeProject, composeFile, ...rest }, ctx) => {
    const filters = dockerComposeFilters(dockerComposeProject)
    const dockerPlugin = await dockerPluginFactory.init({
      ...rest,
      dockerFilters: filters,
    }, ctx)

    return {
      fastifyPlugin: async (app, ...args) => {
        if (dockerPlugin.fastifyPlugin) {
          await dockerPlugin.fastifyPlugin(app, ...args)
        }

        if (composeFile) {
          app.get('/compose-model', async (_req, res) => {
            void res
              .header('Content-Type', 'application/x-yaml')
              .send(await fs.promises.readFile(composeFile, { encoding: 'utf-8' }))
          })
        }
      },
      forwardsEmitter: ({ tunnelNameResolver }) => forwardsEmitter({
        log: ctx.log,
        debounceWait: rest.dockerDebounceWait,
        docker: ,
        filters,
        containerToForwards: composeContainerToForwards({ tunnelNameResolver }),
      }),
    }
  },
}
