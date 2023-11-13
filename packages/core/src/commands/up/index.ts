import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME, ScriptInjection, formatPublicKey, readOrUndefined } from '@preevy/common'
import fs from 'fs'
import path from 'path'
import { rimraf } from 'rimraf'
import yaml from 'yaml'
import { spawn } from 'child_process'
import { mapValues, pickBy } from 'lodash'
import { childProcessPromise } from '../../child-process'
import { TunnelOpts } from '../../ssh'
import { composeModelFilename, fixModelForRemote, localComposeClient, addScriptInjectionsToModel, ComposeBuild, ComposeService } from '../../compose'
import { ensureCustomizedMachine } from './machine'
import { wrapWithDockerSocket } from '../../docker'
import { addComposeTunnelAgentService } from '../../compose-tunnel-agent-client'
import { MachineCreationDriver, MachineDriver, MachineBase } from '../../driver'
import { remoteProjectDir } from '../../remote-files'
import { Logger } from '../../log'
import { FileToCopy, uploadWithSpinner } from '../../upload-files'
import { envMetadata } from '../../env-metadata'
import { EnvId } from '../../env-id'
import { LocalBuildSpec } from './split-build'
import { gitContext } from '../../git'
import { randomString } from '../../strings'

export { localBuildSpecSchema, LocalBuildSpec } from './split-build'

const createCopiedFileInDataDir = (
  { projectLocalDataDir, filesToCopy } : {
    projectLocalDataDir: string
    filesToCopy: FileToCopy[]
  }
) => async (
  filename: string,
  content: string | Buffer
): Promise<{ local: string; remote: string }> => {
  const local = path.join(projectLocalDataDir, filename)
  const result = { local, remote: filename }
  if (await readOrUndefined(local) === Buffer.from(content)) {
    return result
  }
  await fs.promises.mkdir(path.dirname(local), { recursive: true })
  await fs.promises.writeFile(local, content, { flag: 'w' })
  filesToCopy.push(result)
  return result
}

const calcComposeUpArgs = ({ userSpecifiedServices, debug, cwd, build } : {
  userSpecifiedServices: string[]
  debug: boolean
  cwd: string
  build: boolean
}) => {
  const upServices = userSpecifiedServices.length
    ? userSpecifiedServices.concat(COMPOSE_TUNNEL_AGENT_SERVICE_NAME)
    : []

  return [
    ...debug ? ['--verbose'] : [],
    '--project-directory', cwd,
    'up', '-d', '--remove-orphans',
    ...build ? ['--build'] : [],
    ...upServices,
  ]
}

const serviceLinkEnvVars = (
  expectedServiceUrls: { name: string; port: number; url: string }[],
) => Object.fromEntries(
  expectedServiceUrls
    .map(({ name, port, url }) => [`PREEVY_BASE_URI_${name.replace(/[^a-zA-Z0-9_]/g, '_')}_${port}`.toUpperCase(), url])
)

const isEcr = (registry: string) => Boolean(registry.match(/^[0-9]+\.dkr\.ecr\.[^.]+\.*\.amazonaws\.com\/.+/))

const registryImageName = (
  { registry, image, tag }: {
    registry: string
    image: string
    tag: string
  },
  { ecrFormat }: { ecrFormat?: boolean } = {},
) => {
  const formatForEcr = ecrFormat === undefined ? isEcr(registry) : ecrFormat
  return formatForEcr ? `${registry}:${image}-${tag}` : `${registry}/${image}:${tag}`
}

const up = async ({
  debug,
  machineDriver,
  machineDriverName,
  machineCreationDriver,
  tunnelOpts,
  userSpecifiedProjectName,
  userSpecifiedServices,
  scriptInjections,
  composeFiles,
  log,
  dataDir,
  allowedSshHostKeys: hostKey,
  sshTunnelPrivateKey,
  cwd,
  skipUnchangedFiles,
  version,
  envId,
  expectedServiceUrls,
  projectName,
  localBuildSpec,
}: {
  debug: boolean
  machineDriver: MachineDriver
  machineDriverName: string
  machineCreationDriver: MachineCreationDriver
  tunnelOpts: TunnelOpts
  userSpecifiedProjectName: string | undefined
  userSpecifiedServices: string[]
  composeFiles: string[]
  log: Logger
  dataDir: string
  scriptInjections?: Record<string, ScriptInjection>
  sshTunnelPrivateKey: string | Buffer
  allowedSshHostKeys: Buffer
  cwd: string
  skipUnchangedFiles: boolean
  version: string
  envId: EnvId
  expectedServiceUrls: { name: string; port: number; url: string }[]
  projectName: string
  localBuildSpec?: LocalBuildSpec
}): Promise<{ machine: MachineBase }> => {
  const remoteDir = remoteProjectDir(projectName)

  log.debug(`Using compose files: ${composeFiles.join(', ')}`)

  const composeClientWithInjectedArgs = localComposeClient({
    composeFiles,
    env: serviceLinkEnvVars(expectedServiceUrls),
    projectName: userSpecifiedProjectName,
  })

  await using cleanup = new AsyncDisposableStack()

  const { machine, connection, userAndGroup, dockerPlatform } = await ensureCustomizedMachine({
    machineDriver, machineCreationDriver, machineDriverName, envId, log, debug,
  })

  cleanup.defer(() => connection.close())

  const { model: fixedModel, filesToCopy } = await fixModelForRemote(
    { cwd, remoteBaseDir: remoteDir },
    await composeClientWithInjectedArgs.getModel()
  )

  const projectLocalDataDir = path.join(dataDir, projectName)
  await rimraf(projectLocalDataDir)

  const createCopiedFile = createCopiedFileInDataDir({ projectLocalDataDir, filesToCopy })
  const [sshPrivateKeyFile, knownServerPublicKey] = await Promise.all([
    createCopiedFile('tunnel_client_private_key', sshTunnelPrivateKey),
    createCopiedFile('tunnel_server_public_key', formatPublicKey(hostKey)),
  ])

  let remoteModel = addComposeTunnelAgentService({
    envId,
    debug,
    tunnelOpts,
    sshPrivateKeyPath: path.posix.join(remoteDir, sshPrivateKeyFile.remote),
    knownServerPublicKeyPath: path.posix.join(remoteDir, knownServerPublicKey.remote),
    user: userAndGroup.join(':'),
    machineStatusCommand: await machineDriver.machineStatusCommand(machine),
    envMetadata: await envMetadata({ envId, version }),
    composeModelPath: path.posix.join(remoteDir, composeModelFilename),
    privateMode: false,
    defaultAccess: 'public',
    composeProject: projectName,
  }, fixedModel)

  if (scriptInjections) {
    remoteModel = addScriptInjectionsToModel(
      remoteModel,
      serviceName => (serviceName !== COMPOSE_TUNNEL_AGENT_SERVICE_NAME ? scriptInjections : undefined),
    )
  }

  if (localBuildSpec) {
    const tagSuffix = await gitContext(cwd)?.commit({ short: true }) ?? randomString.lowercaseNumeric(8)
    const serviceImage = (service: string, tag: string) => registryImageName(
      {
        registry: localBuildSpec.registry,
        image: `preevy-${envId}-${service}`,
        tag,
      },
      { ecrFormat: localBuildSpec.ecrFormat },
    )

    const buildServices = mapValues(
      pickBy(remoteModel.services, ({ build }) => build),
      ({ build }: { build: ComposeBuild}, service) => {
        const latestImage = serviceImage(service, 'latest')
        const thisImage = serviceImage(service, tagSuffix)
        return ({
          build: Object.assign(build, {
            tags: (build.tags ?? []).concat(thisImage, latestImage),
            cache_from: (build.cache_from ?? []).concat(latestImage),
            cache_to: (build.cache_to ?? []).concat(
              ...localBuildSpec.cacheToLatest
                ? [`type=registry,ref=${latestImage},image-manifest=true,mode=max`]
                : [],
            ),
          }),
        })
      },
    )

    const buildFilename = path.join(projectLocalDataDir, 'build.yaml')
    await fs.promises.writeFile(buildFilename, yaml.stringify({ services: buildServices }))

    await childProcessPromise(spawn('docker', [
      'buildx', 'bake',
      '-f', buildFilename,
      `--set=*.platform=${localBuildSpec.platform ?? dockerPlatform}`,
      '--push',
    ], {
      stdio: 'inherit',
    }))

    for (const serviceName of Object.keys(buildServices)) {
      (remoteModel.services as Record<string, ComposeService>)[serviceName].image = serviceImage(serviceName, tagSuffix)
    }
  }

  const modelStr = yaml.stringify(remoteModel)
  log.debug('model', modelStr)
  const composeFilePath = await createCopiedFile(composeModelFilename, modelStr)

  const { exec } = connection

  await exec(`mkdir -p "${remoteDir}"`)

  log.debug('Files to copy', filesToCopy)

  await uploadWithSpinner(exec, remoteDir, filesToCopy, skipUnchangedFiles)

  const compose = localComposeClient({
    composeFiles: [composeFilePath.local],
    projectName: userSpecifiedProjectName,
  })
  const composeArgs = calcComposeUpArgs({ userSpecifiedServices, debug, cwd, build: !localBuildSpec })

  const withDockerSocket = wrapWithDockerSocket({ connection, log })

  log.info(`Running: docker compose up ${composeArgs.join(' ')}`)
  await withDockerSocket(() => compose.spawnPromise(composeArgs, { stdio: 'inherit' }))

  return { machine }
}

export default up
