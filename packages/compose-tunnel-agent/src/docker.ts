import Docker from 'dockerode'
import { tryParseJson, Logger } from '@preevy/common'
import { throttle } from 'lodash'

const composeFilter = {
  label: ['com.docker.compose.project'],
}

export type RunningService = {
  project: string
  name: string
  networks: string[]
  ports: number[]
  access: 'private' | 'public'
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
    access: (x.Labels['preevy.access'] || 'public') as ('private' | 'public'),
    networks: Object.keys(x.NetworkSettings.Networks),
    // ports may have both IPv6 and IPv4 addresses, ignoring
    ports: [...new Set(x.Ports.filter(p => p.Type === 'tcp').map(p => p.PrivatePort))],
  }))

  return {
    getRunningServices,
    startListening: async ({ onChange }: { onChange: (services: RunningService[]) => void }) => {
      const handler = throttle(async (data?: Buffer) => {
        log.debug('event handler: %j', data && tryParseJson(data.toString()))

        const services = await getRunningServices()
        onChange(services)
      }, debounceWait, { leading: true, trailing: true })

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
      return { close: () => stream.removeAllListeners() }
    },
  }
}

export default client
