import { inspect } from 'util'
import { ComposeTunnelAgentState } from '@preevy/common'
import { RunningService } from './docker/index.js'

const findPendingComposeServiceTunnels = ({
  composeProject,
  composeModel,
  runningServices,
}: {
  composeProject: string
  composeModel: { services: Record<string, unknown> }
  runningServices: Pick<RunningService, 'name' | 'project'>[]
}) => {
  const composeServiceNames = Object.keys(composeModel.services)

  const runningServiceNames = new Set(
    runningServices
      .filter(({ project }) => project === composeProject)
      .map(({ name }) => name)
  )

  return composeServiceNames.filter(service => !runningServiceNames.has(service))
}

export const tunnelsStateCalculator = ({
  composeProject,
  composeModelReader,
}: {
  composeProject?: string
  composeModelReader: () => Promise<{ services: Record<string, unknown> }>
}) => async (
  runningServices: Pick<RunningService, 'name' | 'project'>[]
): Promise<ComposeTunnelAgentState> => {
  if (!composeProject) {
    return { state: 'unknown', reason: 'COMPOSE_PROJECT not set' }
  }

  let composeModel: { services: Record<string, unknown> }
  try {
    composeModel = await composeModelReader()
  } catch (e) {
    return { state: 'unknown', reason: `Could not read compose file: ${inspect(e)}` }
  }

  const pendingServices = findPendingComposeServiceTunnels({ composeProject, composeModel, runningServices })
  if (pendingServices.length) {
    return { state: 'pending', pendingServices }
  }

  return { state: 'stable' }
}
