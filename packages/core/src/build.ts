import { mapValues, pickBy } from 'lodash-es'
import { ComposeModel } from './compose/index.js'
import { randomString } from './strings.js'
import { hasProp } from './nulls.js'

export type ImageRegistry = { registry: string; singleName?: string }

export type BuildSpec = {
  registry?: ImageRegistry
  cacheFromRegistry?: boolean
  noCache?: boolean
  builder?: string
}

const ecrRegex = /^(?<registry>[0-9]+\.dkr\.ecr\.[^.]+\.*\.amazonaws\.com)\/(?<singleName>.+)/

export const parseRegistry = (
  { registry, singleName }: { registry: string; singleName: undefined | string | false },
): ImageRegistry => {
  if (singleName === undefined) {
    const match = ecrRegex.exec(registry)
    if (match) {
      return match.groups as { registry: string; singleName: string }
    }
  }
  return { registry, singleName: typeof singleName === 'string' ? singleName : undefined }
}

type ImageRefFactory = ({ image, tag }: { image: string; tag: string }) => string

const plainImageRefFactory: ImageRefFactory = ({ image, tag }) => `${image}:${tag}`

const registryImageRefFactory = ({ registry, singleName }: ImageRegistry): ImageRefFactory => (
  singleName
    ? ({ image, tag }) => `${registry}/${singleName}:${image}-${tag}`
    : ({ image, tag }) => `${registry}/${image}:${tag}`
)

export const generateBuild = ({
  composeModel,
  buildSpec,
  machineDockerPlatform,
  gitHash,
}: {
  composeModel: ComposeModel
  buildSpec: BuildSpec
  machineDockerPlatform: string
  gitHash: string | undefined
}) => {
  const tagSuffix = gitHash ?? randomString.lowercaseNumeric(8)

  const imageRef = buildSpec.registry
    ? registryImageRefFactory(buildSpec.registry)
    : plainImageRefFactory

  const imageRefForService = (service: string, tag: string) => imageRef({
    image: `preevy-${composeModel.name}-${service}`,
    tag,
  })

  const services = mapValues(
    pickBy(composeModel.services ?? {}, hasProp('build')),
    ({ build, image }, serviceName) => {
      const latestImage = imageRefForService(serviceName, 'latest')
      const thisImage = imageRefForService(serviceName, tagSuffix)

      const cacheFrom = build.cache_from ?? []
      const cacheTo = build.cache_to ?? []
      const tags = build.tags ?? []

      if (buildSpec.registry && buildSpec.cacheFromRegistry) {
        cacheTo.push(`type=registry,ref=${latestImage},mode=max,oci-mediatypes=true,image-manifest=true`)
        cacheFrom.push(latestImage)
        cacheFrom.push(thisImage)
      }

      tags.push(latestImage)
      tags.push(thisImage)

      return {
        image: image ?? thisImage,
        build: {
          ...build,
          tags,
          cache_from: cacheFrom,
          cache_to: cacheTo,
        },
      }
    },
  )

  const buildModel: ComposeModel = { name: composeModel.name, services }

  const createBakeArgs = (modelFilename: string) => [
    '-f', modelFilename,
    ...buildSpec.registry ? ['--push'] : ['--load'],
    ...buildSpec.builder ? [`--builder=${buildSpec.builder}`] : [],
    ...buildSpec.noCache ? ['--no-cache'] : [],
    `--set=*.platform=${machineDockerPlatform}`,
  ]

  const deployModel: ComposeModel = {
    ...composeModel,
    services: {
      ...mapValues(composeModel.services, (service, serviceName) => ({
        ...service,
        image: buildModel.services?.[serviceName]?.image ?? service.image,
      })),
    },
  }

  return { buildModel, createBakeArgs, deployModel }
}
