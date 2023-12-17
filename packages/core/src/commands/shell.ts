import { MachineDriver, isPartialMachine } from '../driver/index.js'
import { Logger } from '../log.js'

const shell = async ({
  envId,
  args,
  machineDriver,
}: {
  envId: string
  args: string[]
  machineDriver: MachineDriver
  log: Logger
}) => {
  const machine = await machineDriver.getMachine({ envId })
  if (!machine || isPartialMachine(machine)) {
    throw new Error(`Machine ${envId} not found`)
  }

  return await machineDriver.spawnRemoteCommand(machine, args, 'inherit')
}

export default shell
