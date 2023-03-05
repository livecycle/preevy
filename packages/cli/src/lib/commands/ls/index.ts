import { asyncMap } from 'iter-tools-es'
import { Logger } from '../../../log'
import { Machine, MachineDriver } from '../../machine'
import { PersistentState } from '../../state'

const ls = async ({
  machineDriver,
  state,
}: {
  machineDriver: MachineDriver
  state: PersistentState
  log: Logger
}): Promise<AsyncIterableIterator<Machine & {
  haveSshKey: boolean
}>> => {
  const machines = machineDriver.listMachines()
  return asyncMap(
    async machine => ({ ...machine, haveSshKey: Boolean(await state.sshKeys.read(machine.sshKeyName)) }),
    machines,
  )
}

export default ls
