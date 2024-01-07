import { TunnelNameResolver } from '@preevy/common'
import { COMPOSE_PROJECT_LABEL, COMPOSE_SERVICE_LABEL } from './labels.js'
import { containerToForwardsBase } from '../../docker/forwards-emitter/services.js'
import { ContainerToForwards } from '../../docker/forwards-emitter/index.js'

export type ComposeServiceMeta = {
  service: string
  project: string
  port: number
}

export const composeContainerToForwards = (
  { tunnelNameResolver }: { tunnelNameResolver: TunnelNameResolver },
): ContainerToForwards => {
  const getBase = containerToForwardsBase({ tunnelNameResolver })
  return container => {
    const { errors, forwards } = getBase(container)
    const project = container.Labels[COMPOSE_PROJECT_LABEL]
    if (!project) {
      errors.push(new Error(`Could not find project label "${COMPOSE_PROJECT_LABEL}" on container "${container.Names[0]}"`))
      return { errors, forwards: [] }
    }
    const service = container.Labels[COMPOSE_SERVICE_LABEL]
    if (!service) {
      errors.push(new Error(`Could not find service label "${COMPOSE_SERVICE_LABEL}" on container "${container.Names[0]}"`))
      return { errors, forwards: [] }
    }

    return {
      errors,
      forwards: forwards.map(f => ({
        ...f,
        meta: { project, service, port: f.port },
        host: service,
      })),
    }
  }
}
