import Docker from 'dockerode'
import { filters } from './filters.js'

export const filteredClient = ({
  docker,
  composeProject,
}: {
  docker: Pick<Docker, 'getEvents' | 'listContainers' | 'getContainer'>
  composeProject?: string
}) => {
  const { listContainers, adhocFilter } = filters({ docker, composeProject })

  const inspectContainer = async (id: string) => {
    const result = await docker.getContainer(id).inspect()
    return result && adhocFilter(result.Config) ? result : undefined
  }

  return { listContainers, inspectContainer }
}

export type DockerFilterClient = ReturnType<typeof filteredClient>
