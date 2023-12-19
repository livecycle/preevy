import { ScriptInjection, COMPOSE_TUNNEL_AGENT_SERVICE_LABELS as PREEVY_LABELS, parseScriptInjectionLabels, TunnelNameResolver } from '@preevy/common'
import Docker from 'dockerode'
import { portFilter } from './filters.js'
import { COMPOSE_PROJECT_LABEL, COMPOSE_SERVICE_LABEL } from './labels.js'
import { Forward } from '../ssh/tunnel-client.js'

const GLOBAL_INJECT_SCRIPTS = process.env.GLOBAL_INJECT_SCRIPTS
  ? JSON.parse(process.env.GLOBAL_INJECT_SCRIPTS) as ScriptInjection[]
  : []

type ContainerInfo = Pick<Docker.ContainerInfo, 'Ports' | 'Labels'>

const containerPorts = (
  container: ContainerInfo,
) => [
  // ports may have both IPv6 and IPv4 addresses, ignoring
  ...new Set(container.Ports.filter(p => p.Type === 'tcp').filter(portFilter(container)).map(p => p.PrivatePort)),
]

type ResolvedPort<Meta> = Omit<Forward<Meta>, 'injects' | 'access'>

export type ComposeServiceMeta = {
  service: string
  project: string
  port: number
}

export const containerToForwards = <Meta>({
  resolvedPorts,
  container,
  defaultAccess,
}: {
  resolvedPorts: ResolvedPort<Meta>[]
  container: ContainerInfo
  defaultAccess: 'private' | 'public'
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
      access: access ?? defaultAccess,
      injects: [...inject.filter(i => i.port === undefined || i.port === port), ...GLOBAL_INJECT_SCRIPTS],
    }
  })
  return { errors, forwards }
}

export const composeContainerToForwards = ({
  tunnelNameResolver,
  defaultAccess,
  container,
}: {
  tunnelNameResolver: TunnelNameResolver
  defaultAccess: 'private' | 'public'
  container: ContainerInfo
}): { errors: Error[]; forwards: Forward<ComposeServiceMeta>[] } => {
  const project = container.Labels[COMPOSE_PROJECT_LABEL]
  const service = container.Labels[COMPOSE_SERVICE_LABEL]
  const ports = containerPorts(container)
  const portExternalNames = new Map(
    tunnelNameResolver({ name: service, ports }).map(({ port, tunnel }) => [port, tunnel]),
  )
  return containerToForwards({
    resolvedPorts: ports.map(port => ({
      meta: { project, service, port },
      externalName: portExternalNames.get(port) as string,
      host: service,
      port,
    })),
    container,
    defaultAccess,
  })
}
