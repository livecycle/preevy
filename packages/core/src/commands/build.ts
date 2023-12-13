import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import { spawn } from 'child_process'
import { ComposeModel } from '../compose/index.js'
import { Logger } from '../log.js'
import { BuildSpec, generateBuild } from '../build.js'
import { gitContext } from '../git.js'
import { childProcessPromise } from '../child-process.js'
import { telemetryEmitter } from '../telemetry/index.js'
import { measureTime } from '../timing.js'

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
  const { buildModel, createBakeArgs, deployModel } = generateBuild({
    composeModel,
    buildSpec,
    gitHash: await gitContext(cwd)?.commit({ short: true }),
    machineDockerPlatform,
  })

  const modelStr = yaml.stringify(buildModel)
  log.debug('build model', modelStr)
  const modelFilename = path.join(projectLocalDataDir, 'docker-compose.build.yaml')
  await fs.promises.writeFile(modelFilename, modelStr, 'utf-8')

  const dockerArgs = [
    ...['buildx', 'bake'],
    ...createBakeArgs(modelFilename),
  ]

  log.info(`Running: docker ${dockerArgs.join(' ')}`)
  const { elapsedTimeSec } = await measureTime(() => childProcessPromise(spawn('docker', dockerArgs, { stdio: 'inherit', cwd, env })))
  telemetryEmitter().capture('build success', {
    elapsed_sec: elapsedTimeSec,
    has_registry: Boolean(buildSpec.registry),
  })
  log.info(`Build step done in ${elapsedTimeSec.toLocaleString(undefined, { maximumFractionDigits: 2 })}s`)

  return { buildModel, deployModel }
}

export default buildCommand
