import { dateReplacer } from '@preevy/common'
import { EOL } from 'os'
import retry from 'p-retry'
import { EnvMetadata, driverMetadataFilename } from '../env-metadata.js'
import { Logger } from '../log.js'
import { REMOTE_DIR_BASE } from '../remote-files.js'
import { scriptExecuter } from '../remote-script-executer.js'
import { withSpinner } from '../spinner.js'
import { telemetryEmitter } from '../telemetry/index.js'
import { MachineConnection, MachineCreationDriver, MachineDriver } from './driver.js'
import { MachineBase, SpecDiffItem, isPartialMachine, machineResourceType } from './machine-model.js'

const machineDiffText = (diff: SpecDiffItem[]) => diff
  .map(({ name, old, new: n }) => `* ${name}: ${old} -> ${n}`).join(EOL)

type Origin = 'existing' | 'new-from-snapshot' | 'new-from-scratch'

const ensureBareMachine = async ({
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
      await machineCreationDriver.deleteResources(
        false,
        { type: machineResourceType, providerId: existingMachine.providerId },
      )
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
    successText: ({ origin }) => `${machineDriver.friendlyName} machine ${recreating ? 'recreated' : `created from ${origin === 'new-from-snapshot' ? 'snapshot' : 'scratch'}`}`,
  })
}

const writeMetadata = async (
  machine: MachineBase,
  machineDriverName: string,
  driverOpts: Record<string, unknown>,
  connection: MachineConnection,
  userAndGroup: [string, string],
) => {
  const metadata: Pick<EnvMetadata, 'machine'> = {
    machine: {
      creationTime: new Date(),
      providerId: machine.providerId,
      locationDescription: machine.locationDescription,
      driver: machineDriverName,
      opts: driverOpts,
    },
  }
  await connection.exec(`mkdir -p "${REMOTE_DIR_BASE}" && chown "${userAndGroup.join(':')}" "${REMOTE_DIR_BASE}"`, { asRoot: true })
  await connection.exec(`tee "${REMOTE_DIR_BASE}/${driverMetadataFilename}"`, {
    stdin: JSON.stringify(metadata, dateReplacer),
  })
}

export const readMetadata = async (connection: MachineConnection): Promise<Pick<EnvMetadata, 'machine'> | undefined> => {
  const { stdout } = await connection.exec(`[ -f "${REMOTE_DIR_BASE}/${driverMetadataFilename}" ] && cat "${REMOTE_DIR_BASE}/${driverMetadataFilename}"`)
  return stdout && JSON.parse(stdout)
}

export const getUserAndGroup = async (connection: Pick<MachineConnection, 'exec'>) => (
  await connection.exec('echo "$(id -u):$(stat -c %g /var/run/docker.sock)"')
).stdout
  .trim()
  .split(':') as [string, string]

export const getDockerPlatform = async (connection: Pick<MachineConnection, 'exec'>) => {
  const arch = (await connection.exec('docker info -f "{{.Architecture}}"')).stdout.trim()
  return arch === 'aarch64' ? 'linux/arm64' : 'linux/amd64'
}

const customizeNewMachine = ({
  log,
  debug,
  envId,
  machine,
  machineDriver,
  machineCreationDriver,
  machineDriverName,
  initialConnection,
}: {
  log: Logger
  debug: boolean
  envId: string
  machine: MachineBase
  machineDriver: MachineDriver
  machineCreationDriver: MachineCreationDriver
  machineDriverName: string
  initialConnection: MachineConnection
}) => async (spinner: { text: string }) => {
  const execScript = scriptExecuter({ exec: initialConnection.exec, log })
  let i = 0
  for (const script of machineDriver.customizationScripts ?? []) {
    i += 1
    spinner.text = `Executing customization scripts (${i}/${machineDriver.customizationScripts?.length})`
    // eslint-disable-next-line no-await-in-loop
    await execScript(script)
  }

  let connection = initialConnection
  spinner.text = 'Ensuring docker is accessible...'
  await retry(
    () => connection.exec('docker run hello-world'),
    {
      minTimeout: 2000,
      maxTimeout: 5000,
      retries: 5,
      onFailedAttempt: async err => {
        log.debug(`Failed to execute docker run hello-world: ${err}`)
        connection[Symbol.dispose]()
        connection = await machineDriver.connect(machine, { log, debug })
      },
    }
  )

  spinner.text = 'Finalizing...'
  const userAndGroup = await getUserAndGroup(connection)
  const dockerPlatform = await getDockerPlatform(connection)

  await Promise.all([
    writeMetadata(machine, machineDriverName, machineCreationDriver.metadata, connection, userAndGroup),
    machineCreationDriver.ensureMachineSnapshot({
      providerId: machine.providerId,
      envId,
      wait: false,
    }),
  ])

  return { connection, userAndGroup, machine, dockerPlatform }
}

export const ensureMachine = async ({
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
}): Promise<{
  machine: MachineBase
  connection: MachineConnection
  userAndGroup: [string, string]
  dockerPlatform: string
}> => {
  const { machine, connection: connectionPromise, origin } = await ensureBareMachine(
    { machineDriver, machineCreationDriver, envId, log, debug },
  )

  return await withSpinner(async spinner => {
    spinner.text = `Connecting to machine at ${machine.locationDescription}`
    const connection = await connectionPromise

    try {
      if (origin === 'new-from-scratch') {
        return await customizeNewMachine({
          log,
          debug,
          envId,
          machine,
          machineDriver,
          machineCreationDriver,
          machineDriverName,
          initialConnection: connection,
        })(spinner)
      }

      const userAndGroup = await getUserAndGroup(connection)
      const dockerPlatform = await getDockerPlatform(connection)

      if (origin === 'new-from-snapshot') {
        spinner.text = 'Finalizing...'
        await writeMetadata(machine, machineDriverName, machineCreationDriver.metadata, connection, userAndGroup)
      }

      return { machine, connection, userAndGroup, dockerPlatform }
    } catch (e) {
      connection[Symbol.dispose]()
      throw e
    }
  }, { opPrefix: 'Configuring machine', successText: 'Machine configured' })
}
