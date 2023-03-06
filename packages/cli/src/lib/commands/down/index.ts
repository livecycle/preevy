import { asyncMap, asyncToArray } from 'iter-tools-es'
import { Logger } from '../../../log'
import { Machine, MachineDriver } from '../../machine'
import { PersistentState } from '../../state'

const down = async ({
  machineDriver,
  envIds,
  throwOnNotFound,
}: {
  machineDriver: MachineDriver
  state: PersistentState
  log: Logger
  envIds: string[]
  throwOnNotFound: boolean
}): Promise<(Machine & { envId: string })[]> => {
  const machines = await asyncToArray(asyncMap(async envId => {
    const machine = await machineDriver.getMachine({ envId })
    if (!machine) {
      if (throwOnNotFound) {
        throw new Error(`Machine for ${envId} not found`)
      }
      return undefined
    }
    await machineDriver.removeMachine(machine.providerId)
    return { ...machine, envId }
  }, envIds))

  return machines.filter(Boolean) as (Machine & { envId: string })[]
}

export default down
