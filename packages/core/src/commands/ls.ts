import { Logger } from '../log.js'
import { MachineDriver } from '../driver/driver.js'

const ls = async ({
  machineDriver,
}: {
  machineDriver: MachineDriver
  log: Logger
}) => machineDriver.listMachines()

export default ls
