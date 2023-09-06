import { DockerFilterClient } from '../../docker'
import { ContainerNotFoundError } from './errors'

export const inspectFilteredContainer = async (dockerFilter: DockerFilterClient, containerId: string) => {
  const container = await dockerFilter.inspectContainer(containerId)
  if (!container) {
    throw new ContainerNotFoundError(containerId)
  }
  return container
}
