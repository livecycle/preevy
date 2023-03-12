import { mapValues } from 'lodash'
import path from 'path'
import { FileToCopy } from './ssh/client'

export type ComposeSecretOrConfig = {
  name: string
  file: string
}

export type ComposeNetwork = null | {}

export type ComposeBindVolume = {
  type: 'bind'
  source: string
  target: string
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

export const fixModelForRemote = (
  { remoteDir, localDir, skipServices = [] }: {
    remoteDir: string
    localDir: string
    skipServices?: string[]
  },
  model: ComposeModel,
): { model: Required<ComposeModel>; filesToCopy: FileToCopy[] } => {
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

  const overrideServices = mapValues(services, (service, serviceName) => {
    if (skipServices.includes(serviceName)) {
      return service
    }

    return ({
      ...service,

      volumes: service.volumes?.map(volume => {
        if (volume.type === 'volume') {
          return volume
        }

        if (volume.type !== 'bind') {
          throw new Error(`Unsupported volume type: ${volume.type} in service ${serviceName}`)
        }

        const remote = remoteVolumePath(volume)
        filesToCopy.push({ local: volume.source, remote })
        return { ...volume, source: path.join(remoteDir, remote) }
      }),
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

// export const addDockerProxyService = (
//   { tunnelOpts, buildDir, port, serviceName }: {
//     tunnelOpts: TunnelOpts
//     buildDir: string
//     port: number
//     serviceName: string
//   },
//   model: ComposeModel
// ): ComposeModel => ({
//   ...model,
//   services: {
//     ...model.services,
//     [serviceName]: {
//       build: {
//         context: buildDir,
//       },
//       // restart: 'always',
//       networks: Object.keys(model.networks || {}),
//       volumes: [
//         {
//           type: 'bind',
//           source: '/var/run/docker.sock',
//           target: '/var/run/docker.sock',
//         },
//         {
//           type: 'bind',
//           source: '/root/.ssh',
//           target: '/root/.ssh',
//         },
//       ],
//       ports: [
//         { mode: 'ingress', target: port, protocol: 'tcp' },
//       ],
//       environment: {
//         SSH_URL: tunnelOpts.url,
//         TLS_SERVERNAME: tunnelOpts.tlsServerName,
//         // eslint-disable-next-line no-template-curly-in-string
//         SSH_CHECK_ONLY: '${SSH_CHECK_ONLY}',
//       },
//     },
//   },
// })
