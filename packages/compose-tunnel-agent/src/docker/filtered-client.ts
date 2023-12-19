import Docker from 'dockerode'
import { DockerFilters } from './filters.js'

export const filteredClient = ({
  docker,
  filters: { apiFilter, adhocFilter },
}: {
  docker: Pick<Docker, 'getEvents' | 'listContainers' | 'getContainer'>
  filters: DockerFilters
}) => ({
  listContainers: () => docker.listContainers({ all: true, filters: { ...apiFilter } }),
  inspectContainer: async (id: string) => {
    const result = await docker.getContainer(id).inspect()
    return result && adhocFilter(result.Config) ? result : undefined
  },
})

export type DockerFilterClient = ReturnType<typeof filteredClient>
