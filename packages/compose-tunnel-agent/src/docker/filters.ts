import Docker from 'dockerode'
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

export const filters = ({
  docker,
  composeProject,
}: {
  docker: Pick<Docker, 'listContainers'>
  composeProject?: string
}) => {
  const apiFilter = {
    label: composeProject ? [`${COMPOSE_PROJECT_LABEL}=${composeProject}`] : [COMPOSE_PROJECT_LABEL],
  }

  const listContainers = async () => await docker.listContainers({
    all: true,
    filters: JSON.stringify({ ...apiFilter }),
  })

  const adhocFilter = (c: Pick<Docker.ContainerInfo, 'Labels'>): boolean => (
    composeProject
      ? c.Labels[COMPOSE_PROJECT_LABEL] === composeProject
      : COMPOSE_PROJECT_LABEL in c.Labels
  )

  return { listContainers, adhocFilter, apiFilter }
}
