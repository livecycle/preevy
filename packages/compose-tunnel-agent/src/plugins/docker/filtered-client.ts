import Docker from 'dockerode'
import { DockerApiFilter, createAdhocFilter } from './filters.js'

export const filteredClient = ({
  docker,
  filters,
}: {
  docker: Pick<Docker, 'getEvents' | 'listContainers' | 'getContainer'>
  filters: DockerApiFilter
}) => {
  const adhocFilter = createAdhocFilter(filters)
  const getContainerFiltered = async (id: string) => {
    const container = docker.getContainer(id)
    const inspect = await container.inspect()
    return inspect && adhocFilter(inspect.Config) ? { inspect, container } : undefined
  }

  return ({
    listContainers: () => docker.listContainers({ all: true, filters }),
    inspectContainer: async (id: string) => (await getContainerFiltered(id))?.inspect,
    getContainer: async (id: string) => (await getContainerFiltered(id))?.container,
  })
}

export type DockerFilterClient = ReturnType<typeof filteredClient>
