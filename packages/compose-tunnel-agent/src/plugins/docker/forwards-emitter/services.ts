import { COMPOSE_TUNNEL_AGENT_SERVICE_LABELS as PREEVY_LABELS, parseScriptInjectionLabels, TunnelNameResolver, generateSchemaErrorMessage } from '@preevy/common'
import Docker from 'dockerode'
import { portFilter } from '../filters.js'
import { ContainerToForwards } from './index.js'
import { Access, accessSchema } from '../../../configuration/opts.js'

type ContainerInfo = Pick<Docker.ContainerInfo, 'Ports' | 'Labels'>

export const containerPorts = (
  container: ContainerInfo,
) => [
  // ports may have both IPv6 and IPv4 addresses, ignoring
  ...new Set(container.Ports.filter(p => p.Type === 'tcp').filter(portFilter(container)).map(p => p.PrivatePort)),
]

export const containerToForwardsBase = (
  { tunnelNameResolver }: { tunnelNameResolver: TunnelNameResolver },
) => (container: Docker.ContainerInfo) => {
  const ports = containerPorts(container)
  const name = container.Names[0]
  const portExternalNames = new Map(
    tunnelNameResolver({ name, ports }).map(({ port, tunnel }) => [port, tunnel]),
  )

  const [inject, errors] = parseScriptInjectionLabels(container.Labels)
  const parsedAccess = accessSchema.optional().safeParse(container.Labels[PREEVY_LABELS.ACCESS])
  let access: Access | undefined
  if (!parsedAccess.success) {
    errors.push(new Error(`Error parsing access label "${PREEVY_LABELS.ACCESS}" on container "${name}": ${generateSchemaErrorMessage(parsedAccess.error)}`))
  } else {
    access = parsedAccess.data
  }

  const forwards = ports.map(port => ({
    externalName: portExternalNames.get(port) as string,
    port,
    access,
    injects: inject.filter(i => i.port === undefined || i.port === port),
  }))

  return { errors, forwards }
}

export const containerToForwards = (
  { tunnelNameResolver }: { tunnelNameResolver: TunnelNameResolver },
): ContainerToForwards => {
  const getBase = containerToForwardsBase({ tunnelNameResolver })
  return container => {
    const { errors, forwards } = getBase(container)
    const name = container.Names[0]
    const host = Object.values(container.NetworkSettings.Networks)[0]?.IPAddress

    if (!host) {
      errors.push(new Error(`Could not find an accessible hostname/IP for container "${name}"`))
      return { errors, forwards: [] }
    }

    return {
      errors,
      forwards: forwards.map(f => ({ ...f, host, meta: { service: name, port: f.port } })),
    }
  }
}
