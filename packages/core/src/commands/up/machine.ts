import { EOL } from 'os'
import retry from 'p-retry'
import { connectSshClient, SSHKeyConfig } from '../../ssh'
import { withSpinner } from '../../spinner'
import { MachineCreationDriver, SpecDiffItem, MachineDriver } from '../../driver'
import { telemetryEmitter } from '../../telemetry'
import { Logger } from '../../log'
import { scriptExecuter } from '../../script-executer'

const machineDiffText = (diff: SpecDiffItem[]) => diff
  .map(({ name, old, new: n }) => `* ${name}: ${old} -> ${n}`).join(EOL)

const ensureMachine = async ({
  machineDriver,
  machineCreationDriver,
  envId,
  sshKey,
  log,
}: {
  machineDriver: MachineDriver
  machineCreationDriver: MachineCreationDriver
  sshKey: SSHKeyConfig
  envId: string
  log: Logger
}) => {
  log.debug('checking for existing machine')
  const existingMachine = await machineCreationDriver.getMachineAndSpecDiff({ envId })
  if (existingMachine && existingMachine.specDiff.length === 0) {
    return { machine: existingMachine, installed: true }
  }

  const recreating = existingMachine && existingMachine.specDiff.length > 0
  if (recreating) {
    log.info(`Recreating machine due to changes:${EOL}${machineDiffText(existingMachine.specDiff)}`)
  }

  return withSpinner(async spinner => {
    if (recreating) {
      spinner.text = 'Deleting machine'
      await machineDriver.removeMachine(existingMachine.providerId, false)
    }
    spinner.text = 'Checking for existing snapshot'
    const machineCreation = await machineCreationDriver.createMachine({ envId, keyConfig: sshKey })

    spinner.text = machineCreation.fromSnapshot
      ? 'Creating from existing snapshot'
      : 'No suitable snapshot yet, creating from scratch'

    telemetryEmitter().capture('create machine', { from_snapshot: machineCreation.fromSnapshot })

    return {
      machine: await machineCreation.machine,
      installed: machineCreation.fromSnapshot,
    }
  }, {
    opPrefix: `${recreating ? 'Recreating' : 'Creating'} ${machineDriver.friendlyName} machine`,
    successText: `${machineDriver.friendlyName} machine ${recreating ? 'recreated' : 'created'}`,
  })
}

export const ensureCustomizedMachine = async ({
  machineDriver,
  machineCreationDriver,
  envId,
  sshKey,
  log,
  debug,
}: {
  machineDriver: MachineDriver
  machineCreationDriver: MachineCreationDriver
  envId: string
  sshKey: SSHKeyConfig
  log: Logger
  debug: boolean
}) => {
  const { machine, installed } = await ensureMachine({ machineDriver, machineCreationDriver, envId, sshKey, log })

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
    await withSpinner(async spinner => {
      const execScript = scriptExecuter({ exec: sshClient.execCommand, log })
      let i = 0
      for (const script of machineDriver.customizationScripts ?? []) {
        i += 1
        spinner.text = `Executing customization scripts (${i}/${machineDriver.customizationScripts?.length})`
        // eslint-disable-next-line no-await-in-loop
        await execScript(script, {})
      }

      spinner.text = 'Ensuring docker is accessible...'
      await retry(
        () => sshClient.execCommand('docker run hello-world', { }),
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

      await machineCreationDriver.ensureMachineSnapshot({
        driverMachineId: machine.providerId,
        envId,
        wait: false,
      })
    }, { opPrefix: 'Configuring machine', successText: 'Machine configured' })
  } catch (e) {
    sshClient.dispose()
    throw e
  }

  return { machine, sshClient }
}
