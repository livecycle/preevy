import { ScriptInjection, COMPOSE_TUNNEL_AGENT_SERVICE_LABELS as PREEVY_LABELS, scriptInjectionFromLabels } from '@preevy/common'
import Docker from 'dockerode'
import { portFilter } from './filters'
import { COMPOSE_PROJECT_LABEL, COMPOSE_SERVICE_LABEL } from './labels'

export type RunningService = {
  project: string
  name: string
  networks: string[]
  ports: number[]
  access: 'private' | 'public'
  inject: ScriptInjection[]
}

export const containerToService = ({
  container,
  defaultAccess,
}: {container: Docker.ContainerInfo; defaultAccess: 'private' | 'public'}): RunningService => ({
  project: container.Labels[COMPOSE_PROJECT_LABEL],
  name: container.Labels[COMPOSE_SERVICE_LABEL],
  access: (container.Labels[PREEVY_LABELS.ACCESS] || defaultAccess) as ('private' | 'public'),
  networks: Object.keys(container.NetworkSettings.Networks),
  // ports may have both IPv6 and IPv4 addresses, ignoring
  ports: [...new Set(container.Ports.filter(p => p.Type === 'tcp').filter(portFilter(container)).map(p => p.PrivatePort))],
  inject: scriptInjectionFromLabels(container.Labels),
})
