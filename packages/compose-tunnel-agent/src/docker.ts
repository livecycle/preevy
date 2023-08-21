import Docker from 'dockerode'
import { tryParseJson, Logger } from '@preevy/common'
import { throttle } from 'lodash'

const targetComposeProject = process.env.COMPOSE_PROJECT
const defaultAccess = process.env.PRIVATE_MODE === 'true' ? 'private' : 'public'

const composeFilter = {
  label: targetComposeProject ? [`com.docker.compose.project=${targetComposeProject}`] : ['com.docker.compose.project'],
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
  ).map(x => {
    let portFilter : (p: Docker.Port)=> boolean
    if (x.Labels['preevy.expose']) {
      const exposedPorts = new Set((x.Labels['preevy.expose']).split(',').map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)))
      portFilter = p => exposedPorts.has(p.PrivatePort)
    } else {
      portFilter = p => !!p.PublicPort
    }

    return ({
      project: x.Labels['com.docker.compose.project'],
      name: x.Labels['com.docker.compose.service'],
      access: (x.Labels['preevy.access'] || defaultAccess) as ('private' | 'public'),
      networks: Object.keys(x.NetworkSettings.Networks),
      // ports may have both IPv6 and IPv4 addresses, ignoring
      ports: [...new Set(x.Ports.filter(p => p.Type === 'tcp' && portFilter(p)).map(p => p.PrivatePort))],
    })
  })

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
