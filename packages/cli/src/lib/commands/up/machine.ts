import retry from 'p-retry'
import { Logger } from '../../../log'
import { MachineDriver, scripts } from '../../machine'
import { connectSshClient } from '../../ssh/client'
import { SSHKeyConfig } from '../../ssh/keypair'
import { withSpinner } from '../../spinner'

const ensureMachine = async ({
  machineDriver,
  envId,
  sshKey,
  log,
}: {
  machineDriver: MachineDriver
  sshKey: SSHKeyConfig
  envId: string
  log: Logger
}) => {
  log.debug('checking for existing machine')
  const existingMachine = await machineDriver.getMachine({ envId })
  if (!existingMachine) {
    return withSpinner(async () => {
      const machine = await machineDriver.createMachine({ envId, keyConfig: sshKey })
      return {
        machine,
        installed: machine.fromSnapshot,
      }
    }, {
      text: `Creating ${machineDriver.friendlyName} machine`,
      successText: `${machineDriver.friendlyName} machine created`,
    })
  }
  return { machine: existingMachine, installed: true }
}

export const ensureCustomizedMachine = async ({
  machineDriver,
  envId,
  sshKey,
  log,
  debug,
}: {
  machineDriver: MachineDriver
  envId: string
  sshKey: SSHKeyConfig
  log: Logger
  debug: boolean
}) => {
  const { machine, installed } = await ensureMachine({ machineDriver, envId, sshKey, log })

  const connect = () => connectSshClient({
    debug,
    host: machine.publicIPAddress,
    username: machine.sshUsername,
    privateKey: sshKey.privateKey.toString('utf-8'),
    log,
  })

  let sshClient = await withSpinner(
    () => retry(
      () => connect(),
      { minTimeout: 2000, maxTimeout: 5000, retries: 10 }
    ),
    { text: `Connecting to ${machineDriver.friendlyName} machine at ${machine.publicIPAddress}` },
  )

  if (installed) {
    return { machine, sshClient }
  }

  try {
    await withSpinner(async () => {
      log.debug('Executing machine scripts')
      for (const script of scripts.CUSTOMIZE_BARE_MACHINE) {
        // eslint-disable-next-line no-await-in-loop
        await sshClient.execScript(script)
      }

      // ensure docker is accessible
      await retry(
        () => sshClient.execCommand('docker run hello-world', {}),
        {
          minTimeout: 2000,
          maxTimeout: 5000,
          retries: 5,
          onFailedAttempt: async err => {
            log.debug(`Failed to execute docker run hello-world: ${err}`)
            sshClient.dispose()
            sshClient = await connect()
          },
        }
      )

      log.info('Creating snapshot in background')
      await machineDriver.ensureMachineSnapshot({
        driverMachineId: machine.providerId,
        envId,
        wait: false,
      })
    }, { opPrefix: 'Configuring machine' })
  } catch (e) {
    sshClient.dispose()
    throw e
  }

  return { machine, sshClient }
}
