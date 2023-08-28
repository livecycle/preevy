import { MachineDriver, isPartialMachine } from '../driver'
import { Logger } from '../log'

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
  const machine = await machineDriver.getEnvMachine({ envId })
  if (!machine || isPartialMachine(machine)) {
    throw new Error(`Machine ${envId} not found`)
  }

  return await machineDriver.spawnRemoteCommand(machine, args, 'inherit')
}

export default shell
