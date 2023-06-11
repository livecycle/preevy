import { asyncMap, asyncToArray } from 'iter-tools-es'
import { mapValues } from 'lodash'
import path from 'path'
import { asyncMapValues } from '../async'
import { lstatOrUndefined } from '../files'
import { FileToCopy } from '../upload-files'
import { PreevyConfig } from '../config'

export type ComposeSecretOrConfig = {
  name: string
  file: string
}

export type ComposeNetwork = null | {}

export type ComposeBindVolume = {
  type: 'bind'
  source: string
  target: string
  // eslint-disable-next-line camelcase
  read_only?: boolean
  bind?: {
    // eslint-disable-next-line camelcase
    create_host_path?: boolean
  }
}

export type ComposeVolume = { type: 'volume' | 'tmpfs' | 'npipe' } | ComposeBindVolume

type ComposeBuild = {
  context: string
  target?: string
  dockerfile?: string
}

type ComposePort = {
  mode: 'ingress'
  target: number
  published?: string
  protocol: 'tcp' | 'udp'
}

type EnvString = `${string}=${string}`

export type ComposeService = {
  build?: ComposeBuild
  restart?: 'always' | 'on-failure'
  volumes?: ComposeVolume[]
  networks?: string[]
  ports?: ComposePort[]
  environment?: Record<string, string | undefined> | EnvString[]
  user?: string
}

export type ComposeModel = {
  name: string
  secrets?: Record<string, ComposeSecretOrConfig>
  configs?: Record<string, ComposeSecretOrConfig>
  services?: Record<string, ComposeService>
  networks?: Record<string, ComposeNetwork>
  'x-preevy'?: PreevyConfig
}

const volumeSkipList = [
  /^\/var\/log(\/|$)/,
  /^\/$/,
]

export const fixModelForRemote = async (
  { skipServices = [], cwd, remoteBaseDir }: {
    skipServices?: string[]
    cwd: string
    remoteBaseDir: string
  },
  model: ComposeModel,
): Promise<{ model: Required<Omit<ComposeModel, 'x-preevy'>>; filesToCopy: FileToCopy[] }> => {
  const filesToCopy: FileToCopy[] = []

  const remotePath = (absolutePath: string) => {
    if (!path.isAbsolute(absolutePath)) {
      throw new Error(`expected absolute path: "${absolutePath}"`)
    }

    const relativePath = path.relative(cwd, absolutePath)

    return relativePath.startsWith('..')
      ? path.join('absolute', absolutePath)
      : path.join('relative', relativePath)
  }

  const overrideSecretsOrConfigs = (
    c?: Record<string, ComposeSecretOrConfig>,
  ) => mapValues(c ?? {}, secretOrConfig => {
    const remote = remotePath(secretOrConfig.file)
    filesToCopy.push({ local: secretOrConfig.file, remote })
    return { ...secretOrConfig, file: path.join(remoteBaseDir, remote) }
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
        if (volumeSkipList.some(re => re.test(volume.source))) {
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

        return { ...volume, source: path.join(remoteBaseDir, remote) }
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
  }
}
