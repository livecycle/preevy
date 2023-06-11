import { MachineDriver, isPartialMachine } from '../driver'
import { Logger } from '../log'

const exec = async ({
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

  const sshProcess = await machineDriver.session(machine, args, 'inherit')

  return new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    sshProcess.on('error', reject)
    sshProcess.on('exit', (code, signal) => resolve({ code, signal }))
  })
}

export default exec
