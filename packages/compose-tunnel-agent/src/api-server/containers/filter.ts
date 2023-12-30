import { DockerFilterClient } from '../../docker/index.js'
import { ContainerNotFoundError } from './errors.js'

export const inspectFilteredContainer = async (dockerFilter: DockerFilterClient, containerId: string) => {
  const container = await dockerFilter.inspectContainer(containerId)
  if (!container) {
    throw new ContainerNotFoundError(containerId)
  }
  return container
}
