import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import { mapValues, pickBy } from 'lodash'
import { spawn } from 'child_process'
import { ComposeModel } from '../compose'
import { Logger } from '../log'
import { BuildSpec, ImageRegistry } from '../build'
import { gitContext } from '../git'
import { randomString } from '../strings'
import { childProcessPromise } from '../child-process'
import { hasProp } from '../nulls'

type ImageRefFactory = ({ image, tag }: { image: string; tag: string }) => string

const plainImageRefFactory: ImageRefFactory = ({ image, tag }) => `${image}:${tag}`

const registryImageRefFactory = ({ registry, singleName }: ImageRegistry): ImageRefFactory => (
  singleName
    ? ({ image, tag }) => `${registry}/${singleName}:${image}-${tag}`
    : ({ image, tag }) => `${registry}/${image}:${tag}`
)

const buildCommand = async ({
  log,
  composeModel,
  projectLocalDataDir,
  cwd,
  buildSpec,
  machineDockerPlatform,
  env,
}: {
  log: Logger
  composeModel: ComposeModel
  projectLocalDataDir: string
  cwd: string
  buildSpec: BuildSpec
  machineDockerPlatform: string
  env?: Record<string, string>
}) => {
  const tagSuffix = await gitContext(cwd)?.commit({ short: true }) ?? randomString.lowercaseNumeric(8)

  const imageRef = buildSpec.registry
    ? registryImageRefFactory(buildSpec.registry)
    : plainImageRefFactory

  const imageRefForService = (service: string, tag: string) => imageRef({
    image: `preevy-${composeModel.name}-${service}`,
    tag,
  })

  const services = mapValues(
    pickBy(composeModel.services ?? {}, hasProp('build')),
    ({ build }, serviceName) => {
      const latestImage = imageRefForService(serviceName, 'latest')
      const thisImage = imageRefForService(serviceName, tagSuffix)

      const cacheFrom = build.cache_from ?? []
      const cacheTo = build.cache_to ?? []
      const tags = build?.tags ?? []

      if (buildSpec.registry && buildSpec.cacheFromRegistry) {
        cacheTo.push(`type=registry,ref=${latestImage},mode=max,oci-mediatypes=true,image-manifest=true`)
        cacheFrom.push(latestImage)
        cacheFrom.push(thisImage)
      }

      tags.push(latestImage)
      tags.push(thisImage)

      return {
        image: thisImage as string,
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
  const modelStr = yaml.stringify(buildModel)
  log.debug('build model', modelStr)
  const modelFilename = path.join(projectLocalDataDir, 'docker-compose.build.yaml')
  await fs.promises.writeFile(modelFilename, modelStr, 'utf-8')

  const bakeArgs = [
    'buildx', 'bake',
    '-f', modelFilename,
    ...buildSpec.registry ? ['--push'] : [],
    ...buildSpec.load ? ['--load'] : [],
    ...buildSpec.builder ? [`--builder=${buildSpec.builder}`] : [],
    ...buildSpec.noCache ? ['--no-cache'] : [],
    `--set=*.platform=${machineDockerPlatform}`,
  ]
  log.info(`Running: docker ${bakeArgs.join(' ')}`)
  await childProcessPromise(spawn('docker', bakeArgs, { stdio: 'inherit', cwd, env }))

  const deployModel: ComposeModel = {
    ...composeModel,
    services: {
      ...mapValues(composeModel.services, (service, serviceName) => ({
        ...service,
        image: buildModel.services?.[serviceName]?.image ?? service.image,
      })),
    },
  }

  return { buildModel, deployModel }
}

export default buildCommand
