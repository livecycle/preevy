import fs from 'fs'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { mapValues } from 'lodash'
import path from 'path'
import { asyncMapValues } from './async'
import { FileToCopy } from './ssh/client'
import { TunnelOpts } from './ssh/url'

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
}

export type ComposeModel = {
  name: string
  secrets?: Record<string, ComposeSecretOrConfig>
  configs?: Record<string, ComposeSecretOrConfig>
  services?: Record<string, ComposeService>
  networks?: Record<string, ComposeNetwork>
}

export const fixModelForRemote = async (
  { remoteDir, localDir, skipServices = [] }: {
    remoteDir: string
    localDir: string
    skipServices?: string[]
  },
  model: ComposeModel,
): Promise<{ model: Required<ComposeModel>; filesToCopy: FileToCopy[] }> => {
  const filesToCopy: FileToCopy[] = []

  const relativePath = (p: string) => {
    const result = path.relative(localDir, p)
    if (result.startsWith('..')) {
      throw new Error(`Path ${p} is not in the project dir ${localDir}`)
    }
    return result
  }

  const remoteSecretOrConfigPath = (
    type: 'secret' | 'config',
    { file }: Pick<ComposeSecretOrConfig, 'file'>,
  ) => path.join(`${type}s`, relativePath(file))

  const overrideSecretsOrConfigs = (
    type: 'secret' | 'config',
    c?: Record<string, ComposeSecretOrConfig>,
  ) => mapValues(c ?? {}, secretOrConfig => {
    const remote = remoteSecretOrConfigPath(type, secretOrConfig)
    filesToCopy.push({ local: secretOrConfig.file, remote })
    return { ...secretOrConfig, file: path.join(remoteDir, remote) }
  })

  const overrideSecrets = overrideSecretsOrConfigs('secret', model.secrets)
  const overrideConfigs = overrideSecretsOrConfigs('config', model.configs)

  const services = model.services ?? {}

  const remoteVolumePath = (
    { source }: Pick<ComposeBindVolume, 'source'>,
  ) => path.join(path.join('volumes'), relativePath(source))

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

        const stats = await fs.promises.stat(volume.source)

        if (!stats.isDirectory() && !stats.isFile() && !stats.isSymbolicLink()) {
          return volume
        }

        const remote = remoteVolumePath(volume)
        filesToCopy.push({ local: { path: volume.source, stats }, remote })
        return { ...volume, source: path.join(remoteDir, remote) }
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

export const addDockerProxyService = (
  { tunnelOpts, buildDir, port, serviceName, sshPrivateKeyPath, knownServerPublicKeyPath }: {
    tunnelOpts: TunnelOpts
    buildDir: string
    port: number
    serviceName: string
    sshPrivateKeyPath: string
    knownServerPublicKeyPath: string
  },
  model: ComposeModel,
): ComposeModel => ({
  ...model,
  services: {
    ...model.services,
    [serviceName]: {
      build: {
        context: buildDir,
      },
      restart: 'always',
      networks: Object.keys(model.networks || {}),
      volumes: [
        {
          type: 'bind',
          source: '/var/run/docker.sock',
          target: '/var/run/docker.sock',
        },
        {
          type: 'bind',
          source: sshPrivateKeyPath,
          target: '/root/.ssh/id_rsa',
          read_only: true,
          bind: { create_host_path: true },
        },
        {
          type: 'bind',
          source: knownServerPublicKeyPath,
          target: '/root/.ssh/known_server_keys/tunnel_server',
          read_only: true,
          bind: { create_host_path: true },
        },
      ],
      ports: [
        { mode: 'ingress', target: port, protocol: 'tcp' },
      ],
      environment: {
        SSH_URL: tunnelOpts.url,
        TLS_SERVERNAME: tunnelOpts.tlsServerName,
      },
    },
  },
})
