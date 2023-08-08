import { Logger } from '../log'
import { MachineDriver } from '../driver/driver'

const ls = async ({
  machineDriver,
}: {
  machineDriver: MachineDriver
  log: Logger
}) => machineDriver.listMachines()

export default ls
