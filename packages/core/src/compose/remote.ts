import yaml from 'yaml'
import path from 'path'
import { mapValues } from 'lodash'
import { MMRegExp, makeRe } from 'minimatch'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { COMPOSE_TUNNEL_AGENT_SERVICE_NAME, MachineStatusCommand, ScriptInjection, formatPublicKey } from '@preevy/common'
import { MachineConnection } from '../driver'
import { ComposeBindVolume, ComposeModel, ComposeSecretOrConfig, composeModelFilename } from './model'
import { REMOTE_DIR_BASE, remoteProjectDir } from '../remote-files'
import { TunnelOpts } from '../ssh'
import { addComposeTunnelAgentService } from '../compose-tunnel-agent-client'
import { Logger } from '../log'
import { FileToCopy } from '../upload-files'
import { envMetadata } from '../env-metadata'
import { EnvId } from '../env-id'
import { asyncMapValues } from '../async'
import { lstatOrUndefined } from '../files'
import { localComposeClient } from './client'

export const fetchRemoteUserModel = async (connection: MachineConnection) => {
  const userModelStr = (await connection.exec(`cat ${REMOTE_DIR_BASE}/projects/*/${composeModelFilename}`)).stdout
  return yaml.parse(userModelStr) as ComposeModel
}

const serviceLinkEnvVars = (
  expectedServiceUrls: { name: string; port: number; url: string }[],
) => Object.fromEntries(
  expectedServiceUrls
    .map(({ name, port, url }) => [`PREEVY_BASE_URI_${name.replace(/[^a-zA-Z0-9_]/g, '_')}_${port}`.toUpperCase(), url])
)

export const defaultVolumeSkipList: string[] = [
  '/var/log',
  '/var/log/**',
  '/var/run',
  '/var/run/**',
  '/',
]

const toPosix = (x:string) => x.split(path.sep).join(path.posix.sep)

export type SkippedVolume = { service: string; source: string; matchingRule: string }

const fixModelForRemote = async (
  { skipServices = [], cwd, remoteBaseDir, volumeSkipList = defaultVolumeSkipList }: {
    skipServices?: string[]
    cwd: string
    remoteBaseDir: string
    volumeSkipList: string[]
  },
  model: ComposeModel,
): Promise<{
  model: Required<Omit<ComposeModel, 'x-preevy' | 'version'>>
  filesToCopy: FileToCopy[]
  skippedVolumes: SkippedVolume[]
}> => {
  const volumeSkipRes = volumeSkipList
    .map(s => makeRe(path.resolve(cwd, s)))
    .map((r, i) => {
      if (!r) {
        throw new Error(`Invalid glob pattern in volumeSkipList: "${volumeSkipList[i]}"`)
      }
      return r as MMRegExp
    })

  const filesToCopy: FileToCopy[] = []
  const skippedVolumes: SkippedVolume[] = []

  const remotePath = (absolutePath: string) => {
    if (!path.isAbsolute(absolutePath)) {
      throw new Error(`expected absolute path: "${absolutePath}"`)
    }
    const relativePath = toPosix(path.relative(cwd, absolutePath))

    return relativePath.startsWith('..')
      ? path.posix.join('absolute', absolutePath)
      : path.posix.join('relative', relativePath)
  }

  const overrideSecretsOrConfigs = (
    c?: Record<string, ComposeSecretOrConfig>,
  ) => mapValues(c ?? {}, secretOrConfig => {
    const remote = remotePath(secretOrConfig.file)
    filesToCopy.push({ local: secretOrConfig.file, remote })
    return { ...secretOrConfig, file: path.posix.join(remoteBaseDir, remote) }
  })

  const overrideSecrets = overrideSecretsOrConfigs(model.secrets)
  const overrideConfigs = overrideSecretsOrConfigs(model.configs)

  const services = model.services ?? {}

  const overrideServices = await asyncMapValues(services, async (service, serviceName) => {
    if (skipServices.includes(serviceName)) {
      return service
    }

    return ({
      ...service,

      volumes: service.volumes && await asyncToArray(asyncMap(async volume => {
        if (volume.type === 'volume') {
          return volume
        }

        if (volume.type !== 'bind') {
          throw new Error(`Unsupported volume type: ${volume.type} in service ${serviceName}`)
        }
        const matchingVolumeSkipIndex = volumeSkipRes.findIndex(re => re.test(volume.source))
        if (matchingVolumeSkipIndex !== -1) {
          skippedVolumes.push({ service: serviceName, source: volume.source, matchingRule: volumeSkipList[matchingVolumeSkipIndex] })
          return volume
        }

        const remote = remotePath(volume.source)
        const stats = await lstatOrUndefined(volume.source)

        if (stats) {
          if (!stats.isDirectory() && !stats.isFile() && !stats.isSymbolicLink()) {
            return volume
          }

          // ignore non-existing files like docker and compose do,
          //  they will be created as directories in the container
          filesToCopy.push({ local: volume.source, remote })
        }

        return { ...volume, source: path.posix.join(remoteBaseDir, remote) }
      }, service.volumes)),
    })
  })

  return {
    model: {
      ...model,
      secrets: overrideSecrets,
      configs: overrideConfigs,
      services: overrideServices,
      networks: model.networks ?? {},
    },
    filesToCopy,
    skippedVolumes,
  }
}

type AgentSettings = {
  version: string
  envId: EnvId
  tunnelOpts: TunnelOpts
  sshTunnelPrivateKey: string | Buffer
  allowedSshHostKeys: Buffer
  userAndGroup: [string, string]
  machineStatusCommand?: MachineStatusCommand
  scriptInjections?: Record<string, ScriptInjection>
  createCopiedFile: (filename: string, content: string | Buffer) => Promise<FileToCopy>
}

export const remoteComposeModel = async ({
  debug,
  userSpecifiedProjectName,
  userSpecifiedServices,
  volumeSkipList,
  composeFiles,
  log,
  cwd,
  expectedServiceUrls,
  projectName,
  agentSettings,
  modelFilter,
}: {
  debug: boolean
  userSpecifiedProjectName: string | undefined
  userSpecifiedServices: string[]
  volumeSkipList: string[]
  composeFiles: string[]
  log: Logger
  cwd: string
  expectedServiceUrls: { name: string; port: number; url: string }[]
  projectName: string
  agentSettings?: AgentSettings
  modelFilter: (userModel: ComposeModel) => Promise<ComposeModel>
}) => {
  const remoteDir = remoteProjectDir(projectName)

  log.debug(`Using compose files: ${composeFiles.join(', ')}`)

  const linkEnvVars = serviceLinkEnvVars(expectedServiceUrls)

  const composeClientWithInjectedArgs = localComposeClient({
    composeFiles,
    env: linkEnvVars,
    projectName: userSpecifiedProjectName,
    projectDirectory: cwd,
  })

  const services = userSpecifiedServices.length
    ? [...userSpecifiedServices].concat(COMPOSE_TUNNEL_AGENT_SERVICE_NAME)
    : []

  const { model: fixedModel, filesToCopy, skippedVolumes } = await fixModelForRemote(
    { cwd, remoteBaseDir: remoteDir, volumeSkipList },
    await modelFilter(await composeClientWithInjectedArgs.getModel(services)),
  )

  let model: ComposeModel = fixedModel
  if (agentSettings) {
    const {
      envId,
      machineStatusCommand,
      userAndGroup,
      scriptInjections,
      tunnelOpts,
      version,
      sshTunnelPrivateKey,
      allowedSshHostKeys,
      createCopiedFile,
    } = agentSettings

    const [sshPrivateKeyFile, knownServerPublicKey] = await Promise.all([
      createCopiedFile('tunnel_client_private_key', sshTunnelPrivateKey),
      createCopiedFile('tunnel_server_public_key', formatPublicKey(allowedSshHostKeys)),
    ])

    model = addComposeTunnelAgentService({
      envId,
      debug,
      tunnelOpts,
      sshPrivateKeyPath: path.posix.join(remoteDir, sshPrivateKeyFile.remote),
      knownServerPublicKeyPath: path.posix.join(remoteDir, knownServerPublicKey.remote),
      user: userAndGroup.join(':'),
      machineStatusCommand,
      envMetadata: await envMetadata({ envId, version }),
      composeModelPath: path.posix.join(remoteDir, composeModelFilename),
      privateMode: false,
      defaultAccess: 'public',
      composeProject: projectName,
      scriptInjections: scriptInjections && (() => scriptInjections),
    }, fixedModel)

    filesToCopy.push(sshPrivateKeyFile, knownServerPublicKey)
  }

  return { model, filesToCopy, skippedVolumes, linkEnvVars }
}
