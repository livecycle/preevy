import { asyncMap } from 'iter-tools-es'
import { Logger } from '../../../log'
import { Machine, MachineDriver } from '../../machine'

const ls = async ({
  machineDriver,
}: {
  machineDriver: MachineDriver
  log: Logger
}): Promise<AsyncIterableIterator<Machine>> => {
  const machines = machineDriver.listMachines()
  return asyncMap(
    async machine => ({ ...machine }),
    machines,
  )
}

export default ls
