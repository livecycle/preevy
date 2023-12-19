import Docker, { GetEventsOptions } from 'dockerode'
import { COMPOSE_TUNNEL_AGENT_SERVICE_LABELS } from '@preevy/common'
import { COMPOSE_PROJECT_LABEL } from './labels.js'

export type RunningService = {
  project: string
  name: string
  networks: string[]
  ports: number[]
  access: 'private' | 'public'
}

const parseExposeLabel = (s: string) => new Set(s.split(',').map(Number).filter(n => !Number.isNaN(n)))

export const portFilter = (
  { Labels: { [COMPOSE_TUNNEL_AGENT_SERVICE_LABELS.EXPOSE]: exposeLabel } }: Pick<Docker.ContainerInfo, 'Labels'>,
) => {
  if (exposeLabel) {
    const ports = parseExposeLabel(exposeLabel)
    return (p: Docker.Port) => ports.has(p.PrivatePort)
  }
  return (p: Docker.Port) => Boolean(p.PublicPort)
}

export type DockerApiFilter = {
  label?: string[]
}

export type DockerFilters = {
  apiFilter: DockerApiFilter
  adhocFilter: (c: Pick<Docker.ContainerInfo, 'Labels'>) => boolean
}

export const composeProjectFilters = ({
  composeProject,
}: {
  composeProject: string
}): DockerFilters => ({
  apiFilter: {
    label: [`${COMPOSE_PROJECT_LABEL}=${composeProject}`],
  },
  adhocFilter: c => c.Labels[COMPOSE_PROJECT_LABEL] === composeProject,
})

export const anyComposeProjectFilters: DockerFilters = {
  apiFilter: {
    label: [COMPOSE_PROJECT_LABEL],
  },
  adhocFilter: c => COMPOSE_PROJECT_LABEL in c.Labels,
}
