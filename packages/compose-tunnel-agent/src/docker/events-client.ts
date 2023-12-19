import Docker from 'dockerode'
import { tryParseJson, Logger, TunnelNameResolver } from '@preevy/common'
import { throttle } from 'lodash-es'
import { inspect } from 'util'
import { DockerFilters } from './filters.js'
import { composeContainerToForwards } from './services.js'
import { Forward } from '../ssh/tunnel-client.js'

export const eventsClient = ({
  log,
  docker,
  debounceWait,
  filters: { apiFilter },
  tunnelNameResolver,
  defaultAccess,
}: {
  log: Logger
  docker: Pick<Docker, 'getEvents' | 'listContainers' | 'getContainer'>
  debounceWait: number
  filters: Pick<DockerFilters, 'apiFilter'>
  tunnelNameResolver: TunnelNameResolver
  defaultAccess: 'private' | 'public'
}) => {
  const getForwards = async (): Promise<Forward[]> => (
    await docker.listContainers({ all: true, filters: { ...apiFilter } })
  ).flatMap(container => {
    const { errors, forwards } = composeContainerToForwards({ container, defaultAccess, tunnelNameResolver })
    if (errors.length) {
      log.warn('error parsing docker container "%s" info, some information may be missing: %j', container.Names?.[0], inspect(errors))
    }
    return forwards
  })

  const startListening = async ({ onChange }: { onChange: (forwards: Forward[]) => void }) => {
    const handler = throttle(async (data?: Buffer) => {
      log.debug('event handler: %j', data && tryParseJson(data.toString()))

      const forwards = await getForwards()
      onChange(forwards)
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

  return { getForwards, startListening }
}

export type DockerEventsClient = ReturnType<typeof eventsClient>
