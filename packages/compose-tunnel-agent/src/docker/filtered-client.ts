import Docker from 'dockerode'
import { DockerFilters } from './filters.js'

export const filteredClient = ({
  docker,
  filters: { apiFilter, adhocFilter },
}: {
  docker: Pick<Docker, 'getEvents' | 'listContainers' | 'getContainer'>
  filters: DockerFilters
}) => {
  const getContainerFiltered = async (id: string) => {
    const container = docker.getContainer(id)
    const inspect = await container.inspect()
    return inspect && adhocFilter(inspect.Config) ? { inspect, container } : undefined
  }

  return ({
    listContainers: () => docker.listContainers({ all: true, filters: { ...apiFilter } }),
    inspectContainer: async (id: string) => (await getContainerFiltered(id))?.inspect,
    getContainer: async (id: string) => (await getContainerFiltered(id))?.container,
  })
}

export type DockerFilterClient = ReturnType<typeof filteredClient>
