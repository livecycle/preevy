import { Logger } from '../../log'
import { Machine, MachineDriver, PartialMachine } from '../../driver'

const ls = async ({
  machineDriver,
}: {
  machineDriver: MachineDriver
  log: Logger
}): Promise<AsyncIterableIterator<Machine | PartialMachine>> => machineDriver.listMachines()

export default ls
