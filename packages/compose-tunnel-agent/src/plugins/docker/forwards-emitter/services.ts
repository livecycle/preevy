import { ScriptInjection, COMPOSE_TUNNEL_AGENT_SERVICE_LABELS as PREEVY_LABELS, parseScriptInjectionLabels, TunnelNameResolver } from '@preevy/common'
import Docker from 'dockerode'
import { portFilter } from '../filters.js'
import { COMPOSE_PROJECT_LABEL, COMPOSE_SERVICE_LABEL } from './labels.js'
import { Forward } from '../../../forwards.js'

type ContainerInfo = Pick<Docker.ContainerInfo, 'Ports' | 'Labels'>

const containerPorts = (
  container: ContainerInfo,
) => [
  // ports may have both IPv6 and IPv4 addresses, ignoring
  ...new Set(container.Ports.filter(p => p.Type === 'tcp').filter(portFilter(container)).map(p => p.PrivatePort)),
]

type ResolvedPort<Meta extends {}> = Omit<Forward<Meta>, 'injects' | 'access'>

export type ComposeServiceMeta = {
  service: string
  project: string
  port: number
}

const containerToForwards = <Meta extends {}>({
  globalInjects,
  resolvedPorts,
  container,
}: {
  globalInjects: ScriptInjection[]
  resolvedPorts: ResolvedPort<Meta>[]
  container: ContainerInfo
}): { errors: Error[]; forwards: Forward<Meta>[] } => {
  const [inject, errors] = parseScriptInjectionLabels(container.Labels)
  const access = container.Labels[PREEVY_LABELS.ACCESS] as undefined | 'private' | 'public'

  const forwards = resolvedPorts.map(x => {
    const { meta, externalName, host, port } = x
    return {
      meta,
      host,
      port,
      externalName,
      access,
      injects: [...inject.filter(i => i.port === undefined || i.port === port), ...globalInjects],
    }
  })
  return { errors, forwards }
}

export const composeContainerToForwards = ({
  globalInjects = [],
  tunnelNameResolver,
  container,
}: {
  globalInjects?: ScriptInjection[]
  tunnelNameResolver: TunnelNameResolver
  container: ContainerInfo
}): { errors: Error[]; forwards: Forward<ComposeServiceMeta>[] } => {
  const project = container.Labels[COMPOSE_PROJECT_LABEL]
  const service = container.Labels[COMPOSE_SERVICE_LABEL]
  const ports = containerPorts(container)
  const portExternalNames = new Map(
    tunnelNameResolver({ name: service, ports }).map(({ port, tunnel }) => [port, tunnel]),
  )
  return containerToForwards({
    globalInjects,
    resolvedPorts: ports.map(port => ({
      meta: { project, service, port },
      externalName: portExternalNames.get(port) as string,
      host: service,
      port,
    })),
    container,
  })
}
