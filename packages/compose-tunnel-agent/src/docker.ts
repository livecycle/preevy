import Docker from 'dockerode'
import { throttle } from 'lodash'
import { tryParseJson, Logger } from '@preevy/common'

const composeFilter = {
  label: ['com.docker.compose.project'],
}

export type RunningService = {
  project: string
  name: string
  networks: string[]
  ports: number[]
}

const client = ({
  log,
  docker,
  debounceWait,
}: {
  log: Logger
  docker: Pick<Docker, 'getEvents' | 'listContainers'>
  debounceWait: number
}) => {
  const getRunningServices = async (): Promise<RunningService[]> => (
    await docker.listContainers({
      all: true,
      filters: {
        ...composeFilter,
      },
    })
  ).map(x => ({
    project: x.Labels['com.docker.compose.project'],
    name: x.Labels['com.docker.compose.service'],
    networks: Object.keys(x.NetworkSettings.Networks),
    // ports may have both IPv6 and IPv4 addresses, ignoring
    ports: [...new Set(x.Ports.filter(p => p.Type === 'tcp').map(p => p.PrivatePort))],
  }))

  return {
    getRunningServices,
    startListening: async ({ onChange }: { onChange: (services: RunningService[]) => void }) => {
      const handler = throttle(
        async (data?: Buffer) => {
          log.debug('event handler: %j', data && tryParseJson(data.toString()))

          const services = await getRunningServices()
          onChange(services)
        },
        debounceWait
      )

      const stream = await docker.getEvents({
        filters: {
          ...composeFilter,
          event: ['start', 'stop', 'pause', 'unpause', 'create', 'destroy', 'rename', 'update'],
          type: ['container'],
        },
        since: 0,
      })
      stream.on('data', handler)
      log.info('listening on docker')
      void handler()
    },
  }
}

export default client
