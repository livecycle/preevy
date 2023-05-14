import { Logger } from '../../log'
import { Machine, MachineDriver } from '../../driver'

const ls = async ({
  machineDriver,
}: {
  machineDriver: MachineDriver
  log: Logger
}): Promise<AsyncIterableIterator<Machine>> => machineDriver.listMachines()

export default ls
