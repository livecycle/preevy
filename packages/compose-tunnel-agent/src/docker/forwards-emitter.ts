import { Duplex } from 'stream'
import Docker from 'dockerode'
import { EventEmitter } from 'tseep'
import { tryParseJson, Logger, TunnelNameResolver, ScriptInjection } from '@preevy/common'
import { throttle } from 'lodash-es'
import { inspect } from 'util'
import { DockerFilters } from './filters.js'
import { composeContainerToForwards } from './services.js'
import { Forward, ForwardsEvents, ForwardsEmitter } from '../forwards.js'
import { ensureClosed } from '../socket.js'

export const forwardsEmitter = async ({
  log,
  docker,
  debounceWait,
  filters: { apiFilter },
  tunnelNameResolver,
  globalInjects,
  defaultAccess,
}: {
  log: Logger
  docker: Pick<Docker, 'getEvents' | 'listContainers' | 'getContainer'>
  debounceWait: number
  filters: Pick<DockerFilters, 'apiFilter'>
  tunnelNameResolver: TunnelNameResolver
  globalInjects: ScriptInjection[]
  defaultAccess: 'private' | 'public'
}): Promise<ForwardsEmitter> => {
  const getForwards = async (): Promise<Forward[]> => (
    await docker.listContainers({ all: true, filters: { ...apiFilter } })
  ).flatMap(container => {
    const { errors, forwards } = composeContainerToForwards({
      container,
      defaultAccess,
      tunnelNameResolver,
      globalInjects,
    })
    if (errors.length) {
      log.warn('error parsing docker container "%s" info, some information may be missing: %j', container.Names?.[0], inspect(errors))
    }
    return forwards
  })

  const emitter = new EventEmitter<ForwardsEvents>()
  const handler = throttle(async (data?: Buffer) => {
    log.debug('event handler: %j', data && tryParseJson(data.toString()))
    const forwards = await getForwards()
    emitter.emit('forwards', forwards)
  }, debounceWait, { leading: true, trailing: true })

  const stream = await docker.getEvents({
    filters: {
      ...apiFilter,
      event: ['start', 'stop', 'pause', 'unpause', 'create', 'destroy', 'rename', 'update'],
      type: ['container'],
    },
    since: 0,
  }) as NodeJS.ReadableStream & { socket: Duplex }
  log.info('listening on docker')
  stream.on('data', handler)
  void handler()
  return Object.assign(emitter, {
    [Symbol.asyncDispose]: async () => {
      stream.off('data', handler)
      await ensureClosed(stream.socket)
    },
  })
}
