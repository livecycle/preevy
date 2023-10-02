import Docker from 'dockerode'
import { tryParseJson, Logger, ScriptInjection } from '@preevy/common'
import { set, throttle } from 'lodash'
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

const reviveScriptInjection = ({ pathRegex, ...v }: ScriptInjection) => ({
  ...pathRegex && { pathRegex: new RegExp(pathRegex) },
  ...v,
})

export const scriptInjectionFromLabels = (labels : Record<string, string>): ScriptInjection[] => {
  const re = /^preevy\.inject_script\.(?<id>.+?)\.(?<key>[^.]+)$/
  const scripts:{[id:string]: Partial<ScriptInjection> } = {}
  for (const [label, value] of Object.entries(labels)) {
    const match = label.match(re)?.groups
    if (match) {
      set(scripts, [match.id, match.attribute], value)
    }
  }
  return (Object.values(scripts).filter(x => !!x.src) as ScriptInjection[]).map(reviveScriptInjection)
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

  const toService = (container: Docker.ContainerInfo) => containerToService({ container, defaultAccess })
  const getRunningServices = async (): Promise<RunningService[]> => (await listContainers()).map(toService)

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
