import Docker from 'dockerode'
import { tryParseJson, Logger, COMPOSE_TUNNEL_AGENT_SERVICE_LABELS as LABELS, ScriptInjection } from '@preevy/common'
import { throttle } from 'lodash'
import { filters, portFilter } from './filters'
import { COMPOSE_PROJECT_LABEL, COMPOSE_SERVICE_LABEL } from './labels'

export type RunningService = {
  project: string
  name: string
  networks: string[]
  ports: number[]
  access: 'private' | 'public'
  inject?: ScriptInjection[]
}

export const eventsClient = ({
  log,
  docker,
  debounceWait,
  composeProject,
  defaultAccess,
}: {
  log: Logger
  docker: Pick<Docker, 'getEvents' | 'listContainers' | 'getContainer'>
  debounceWait: number
  composeProject?: string
  defaultAccess: 'private' | 'public'
}) => {
  const { listContainers, apiFilter } = filters({ docker, composeProject })

  const containerToService = (c: Docker.ContainerInfo): RunningService => ({
    project: c.Labels[COMPOSE_PROJECT_LABEL],
    name: c.Labels[COMPOSE_SERVICE_LABEL],
    access: (c.Labels[LABELS.ACCESS] || defaultAccess) as ('private' | 'public'),
    networks: Object.keys(c.NetworkSettings.Networks),
    // ports may have both IPv6 and IPv4 addresses, ignoring
    ports: [...new Set(c.Ports.filter(p => p.Type === 'tcp').filter(portFilter(c)).map(p => p.PrivatePort))],
    inject: c.Labels[LABELS.INJECT_SCRIPT_URL]
      ? [{
        url: c.Labels[LABELS.INJECT_SCRIPT_URL],
        ...c.Labels[LABELS.INJECT_SCRIPT_PATH_REGEX] && {
          pathRegex: new RegExp(c.Labels[LABELS.INJECT_SCRIPT_PATH_REGEX]),
        },
      }]
      : undefined,
  })

  const getRunningServices = async (): Promise<RunningService[]> => (await listContainers()).map(containerToService)

  const startListening = async ({ onChange }: { onChange: (services: RunningService[]) => void }) => {
    const handler = throttle(async (data?: Buffer) => {
      log.debug('event handler: %j', data && tryParseJson(data.toString()))

      const services = await getRunningServices()
      onChange(services)
    }, debounceWait, { leading: true, trailing: true })

    const stream = await docker.getEvents({
      filters: {
        ...apiFilter,
        event: ['start', 'stop', 'pause', 'unpause', 'create', 'destroy', 'rename', 'update'],
        type: ['container'],
      },
      since: 0,
    })
    stream.on('data', handler)
    log.info('listening on docker')
    void handler()
    return { close: () => stream.removeAllListeners() }
  }

  return { getRunningServices, startListening }
}

export type DockerEventsClient = ReturnType<typeof eventsClient>
