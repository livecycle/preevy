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

export type ComposeBuild = {
  context: string
  target?: string
  dockerfile?: string
  tags?: string[]
  cache_from?: string[]
  cache_to?: string[]
  platforms?: string[]
  no_cache?: boolean
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
  extra_hosts?: string[]
  networks?: string[]
  ports?: ComposePort[]
  environment?: Record<string, string | undefined> | EnvString[]
  user?: string
  labels?: Record<string, string>
  image?: string
  platform?: string
}

export type ComposeModel = {
  name: string
  version?: string
  secrets?: Record<string, ComposeSecretOrConfig>
  configs?: Record<string, ComposeSecretOrConfig>
  services?: Record<string, ComposeService>
  networks?: Record<string, ComposeNetwork>
  'x-preevy'?: PreevyConfig
}

export const composeModelFilename = 'docker-compose.yaml'
