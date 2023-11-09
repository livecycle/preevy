import Docker from 'dockerode'
import { tryParseJson, Logger, ScriptInjection } from '@preevy/common'
import { throttle } from 'lodash'
import { inspect } from 'util'
import { filters } from './filters'
import { containerToService } from './services'

export type RunningService = {
  project: string
  name: string
  networks: string[]
  ports: number[]
  access: 'private' | 'public'
  inject: ScriptInjection[]
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

  const getRunningServices = async (): Promise<RunningService[]> => (await listContainers()).map(container => {
    const { errors, ...service } = containerToService({ container, defaultAccess })
    if (errors.length) {
      log.warn('error parsing docker container "%s" info, some information may be missing: %j', container.Names?.[0], inspect(errors))
    }
    return service
  })

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
