import { EOL } from 'os'
import retry from 'p-retry'
import { dateReplacer } from '@preevy/common'
import { withSpinner } from '../../spinner'
import { MachineCreationDriver, SpecDiffItem, MachineDriver, MachineConnection, MachineBase, isPartialMachine, machineResourceType } from '../../driver'
import { telemetryEmitter } from '../../telemetry'
import { Logger } from '../../log'
import { scriptExecuter } from '../../remote-script-executer'
import { EnvMetadata, driverMetadataFilename } from '../../env-metadata'
import { REMOTE_DIR_BASE } from '../../remote-files'

const machineDiffText = (diff: SpecDiffItem[]) => diff
  .map(({ name, old, new: n }) => `* ${name}: ${old} -> ${n}`).join(EOL)

type Origin = 'existing' | 'new-from-snapshot' | 'new-from-scratch'

const ensureMachine = async ({
  machineDriver,
  machineCreationDriver,
  envId,
  log,
  debug,
}: {
  machineDriver: MachineDriver
  machineCreationDriver: MachineCreationDriver
  envId: string
  log: Logger
  debug: boolean
}): Promise<{ machine: MachineBase; origin: Origin; connection: Promise<MachineConnection> }> => {
  log.debug('checking for existing machine')
  const existingMachine = await machineCreationDriver.getMachineAndSpecDiff({ envId })

  let recreating = false
  if (existingMachine) {
    if (isPartialMachine(existingMachine)) {
      recreating = true
      log.info(`Recreating machine due to error state: ${existingMachine.error}`)
    } else {
      recreating = existingMachine.specDiff.length > 0
      if (recreating) {
        log.info(`Recreating machine due to changes:${EOL}${machineDiffText(existingMachine.specDiff)}`)
      } else {
        return {
          machine: existingMachine,
          origin: 'existing',
          connection: machineDriver.connect(existingMachine, { log, debug }),
        }
      }
    }
  }

  return await withSpinner(async spinner => {
    if (existingMachine && recreating) {
      spinner.text = 'Deleting machine'
      await machineDriver.deleteResources(false, { type: machineResourceType, providerId: existingMachine.providerId })
    }
    spinner.text = 'Checking for existing snapshot'
    const machineCreation = await machineCreationDriver.createMachine({ envId })

    spinner.text = machineCreation.fromSnapshot
      ? 'Creating from existing snapshot'
      : 'No suitable snapshot yet, creating from scratch'

    telemetryEmitter().capture('create machine', { from_snapshot: machineCreation.fromSnapshot })

    const { machine, connection } = await machineCreation.result

    return {
      machine,
      connection: Promise.resolve(connection),
      origin: machineCreation.fromSnapshot ? 'new-from-snapshot' : 'new-from-scratch',
    }
  }, {
    opPrefix: `${recreating ? 'Recreating' : 'Creating'} ${machineDriver.friendlyName} machine`,
    successText: `${machineDriver.friendlyName} machine ${recreating ? 'recreated' : 'created'}`,
  })
}

const writeMetadata = async (
  machine: MachineBase,
  machineDriverName: string,
  driverOpts: Record<string, unknown>,
  connection: MachineConnection
) => {
  const metadata: Pick<EnvMetadata, 'driver'> = {
    driver: {
      creationTime: new Date(),
      machineLocationDescription: machine.locationDescription,
      driver: machineDriverName,
      opts: driverOpts,
    },
  }
  await connection.exec(`mkdir -p "${REMOTE_DIR_BASE}" && cat > "${REMOTE_DIR_BASE}/${driverMetadataFilename}"`, {
    stdin: Buffer.from(JSON.stringify(metadata, dateReplacer)),
  })
}

export const ensureCustomizedMachine = async ({
  machineDriver,
  machineCreationDriver,
  machineDriverName,
  envId,
  log,
  debug,
}: {
  machineDriver: MachineDriver
  machineCreationDriver: MachineCreationDriver
  machineDriverName: string
  envId: string
  log: Logger
  debug: boolean
}): Promise<{ machine: MachineBase; connection: MachineConnection }> => {
  const { machine, connection: connectionPromise, origin } = await ensureMachine(
    { machineDriver, machineCreationDriver, envId, log, debug },
  )

  let connection = await withSpinner(
    () => connectionPromise,
    { text: `Connecting to machine at ${machine.locationDescription}` },
  )

  if (origin === 'existing') {
    return { machine, connection }
  }

  try {
    await withSpinner(async spinner => {
      const execScript = scriptExecuter({ exec: connection.exec, log })
      let i = 0
      for (const script of machineDriver.customizationScripts ?? []) {
        i += 1
        spinner.text = `Executing customization scripts (${i}/${machineDriver.customizationScripts?.length})`
        // eslint-disable-next-line no-await-in-loop
        await execScript(script, {})
      }

      spinner.text = 'Ensuring docker is accessible...'
      await retry(
        () => connection.exec('docker run hello-world', { }),
        {
          minTimeout: 2000,
          maxTimeout: 5000,
          retries: 5,
          onFailedAttempt: async err => {
            log.debug(`Failed to execute docker run hello-world: ${err}`)
            await connection.close()
            connection = await machineDriver.connect(machine, { log, debug })
          },
        }
      )

      await Promise.all([
        writeMetadata(machine, machineDriverName, machineCreationDriver.metadata, connection),
        machineCreationDriver.ensureMachineSnapshot({
          providerId: machine.providerId,
          envId,
          wait: false,
        }),
      ])
    }, { opPrefix: 'Configuring machine', successText: 'Machine configured' })
  } catch (e) {
    await connection.close()
    throw e
  }

  return { machine, connection }
}
