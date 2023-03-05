import Docker from 'dockerode'
import { debounce } from 'lodash-es'
import { tryParseJson } from './json.js'

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
  docker,
  debounceWait,
}: {
  docker: Pick<Docker, 'getEvents' | 'listContainers'>
  debounceWait: number
}) => {
  const getRunningServices = async (): Promise<RunningService[]> =>
    (
      await docker.listContainers({
        filters: {
          ...composeFilter,
          status: ['running'],
        },
      })
    ).map(x => ({
      project: x.Labels['com.docker.compose.project'],
      name: x.Labels['com.docker.compose.service'],
      networks: Object.keys(x.NetworkSettings.Networks),
      ports: x.Ports.filter(p => p.Type === 'tcp').map(p => p.PrivatePort),
    }))

  return {
    listenToContainers: async ({ onChange }: { onChange: (services: RunningService[]) => void }) => {
      const handler = debounce(
        async (data?: Buffer) => {
          console.log('handler', data && tryParseJson(data.toString()))

          const services = await getRunningServices()
          onChange(services)
        },
        debounceWait,
        { leading: true }
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
      console.log('listening on docker')
      void handler()
    },
  }
}

export default client
