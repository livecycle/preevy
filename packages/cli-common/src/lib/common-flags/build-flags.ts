import { Flags } from '@oclif/core'
import { InferredFlags } from '@oclif/core/lib/interfaces/index.js'
import { BuildSpec, parseRegistry } from '@preevy/core'

const helpGroup = 'BUILD'

export const buildFlags = {
  'no-build': Flags.boolean({
    description: 'Do not build images',
    helpGroup,
    allowNo: false,
    default: false,
    required: false,
  }),
  registry: Flags.string({
    description: 'Image registry. If this flag is specified, the "build-context" flag defaults to "*local"',
    helpGroup,
    required: false,
  }),
  'registry-single-name': Flags.string({
    description: 'Use single name for image registry, ECR-style. Default: auto-detect from "registry" flag',
    helpGroup,
    required: false,
    dependsOn: ['registry'],
  }),
  'no-registry-single-name': Flags.boolean({
    description: 'Disable auto-detection for ECR-style registry single name',
    helpGroup,
    allowNo: false,
    required: false,
    exclusive: ['registry-single-name'],
  }),
  'no-registry-cache': Flags.boolean({
    description: 'Do not add the registry as a cache source and target',
    helpGroup,
    allowNo: false,
    required: false,
    dependsOn: ['registry'],
  }),
  builder: Flags.string({
    description: 'Builder to use',
    helpGroup,
    required: false,
  }),
  'no-cache': Flags.boolean({
    description: 'Do not use cache when building the images',
    helpGroup,
    allowNo: false,
    required: false,
  }),
} as const

export const parseBuildFlags = (flags: Omit<InferredFlags<typeof buildFlags>, 'json'>): BuildSpec | undefined => {
  if (flags['no-build']) {
    return undefined
  }

  return {
    builder: flags.builder,
    noCache: flags['no-cache'],
    cacheFromRegistry: !flags['no-registry-cache'],
    ...flags.registry && {
      registry: parseRegistry({
        registry: flags.registry,
        singleName: flags['no-registry-single-name'] ? false : flags['registry-single-name'],
      }),
    },
  }
}
