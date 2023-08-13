import { ChildProcess, spawn, StdioOptions } from 'child_process'
import yaml from 'yaml'
import { WriteStream } from 'fs'
import { RequiredProperties, hasPropertyDefined } from '@preevy/common'
import { ComposeModel, ComposeService } from './model'
import { childProcessPromise, childProcessStdoutPromise, ProcessError } from '../child-process'

const DOCKER_COMPOSE_NO_CONFIGURATION_FILE_ERROR_CODE = 14

class LoadComposeFileError extends Error {
  constructor(readonly cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause)
    super(`Could not load compose file: ${causeMessage}`)
  }
}

export class NoComposeFilesError extends LoadComposeFileError {
  constructor() {
    super('No compose files found')
  }
}

class DockerIsNotInstalled extends Error {
  constructor(readonly cause: Error) {
    super(`Failed to run 'docker compose', is Docker installed with the Compose plugin? (${cause.message})`)
  }
}

const isExposedService = (x: [string, ComposeService]): x is [string, RequiredProperties<ComposeService, 'ports'>] => hasPropertyDefined(x[1], 'ports')
const getExposedServices = (model: Pick<ComposeModel, 'services'>) => Object.entries(model.services ?? []).filter(isExposedService)

export const getExposedTcpServicePorts = (model: Pick<ComposeModel, 'services'>) => getExposedServices(model)
  .map(([name, { ports }]) => ({
    name,
    ports: ports
      .filter(({ protocol }) => protocol === 'tcp')
      .map(({ target }) => target),
  }))

const composeFileArgs = (
  composeFiles: string[] | Buffer,
  projectName?: string,
) => [
  ...(projectName ? ['-p', projectName] : []),
  ...(Buffer.isBuffer(composeFiles) ? ['-f', '-'] : composeFiles.flatMap(file => ['-f', file])),
]

type Executer = (opts: { args: string[]; stdin?: Buffer }) => Promise<string>

const composeClient = (
  executer: Executer,
  composeFiles: string[] | Buffer,
) => {
  const execComposeCommand = async (args: string[]) => await executer({
    args,
    stdin: Buffer.isBuffer(composeFiles) ? composeFiles : undefined,
  }).catch(e => {
    if (e.code === 'ENOENT') {
      throw new DockerIsNotInstalled(e)
    }
    throw e
  })

  const getModel = async () => yaml.parse(await execComposeCommand(['convert'])) as ComposeModel

  return {
    getModel,
    getModelOrError: async () => await getModel().catch(e => {
      if (e instanceof DockerIsNotInstalled
          || (e instanceof ProcessError && (e.code === DOCKER_COMPOSE_NO_CONFIGURATION_FILE_ERROR_CODE))) {
        return new LoadComposeFileError(e)
      }
      throw e
    }),
    getModelName: async () => (await getModel()).name,
    getServiceLogs: (service: string) => execComposeCommand(['logs', '--no-color', '--no-log-prefix', service]),
    getServiceUrl: (service: string, port: number) => execComposeCommand(['port', service, String(port)]),
  }
}

export type ComposeClient = ReturnType<typeof composeClient>

// from: https://stackoverflow.com/a/67605309
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParametersExceptFirst<F> = F extends (arg0: any, ...rest: infer R) => any ? R : never;

export const localComposeClient = (
  { composeFiles, projectName, env }: {
    composeFiles: string[] | Buffer
    projectName?: string
    env?: NodeJS.ProcessEnv
  },
) => {
  const insertStdin = (stdio: StdioOptions | undefined) => {
    if (!Buffer.isBuffer(composeFiles)) {
      return stdio
    }
    if (Array.isArray(stdio)) {
      return [null, ...stdio.slice(1)]
    }
    if (typeof stdio === 'string') {
      return [null, stdio, stdio]
    }
    return [null, null, null]
  }

  const fileArgs = composeFileArgs(composeFiles, projectName)

  const spawnComposeArgs = (...[args, opts]: ParametersExceptFirst<typeof spawn>): Parameters<typeof spawn> => [
    'docker',
    [
      'compose',
      ...fileArgs,
      ...args,
    ],
    {
      ...opts,
      env: {
        ...process.env,
        ...env,
        ...opts.env,
      },
      stdio: insertStdin(opts.stdio),
    },
  ]

  const addStdIn = (p: ChildProcess) => {
    if (Buffer.isBuffer(composeFiles)) {
      const stdin = p.stdin as WriteStream
      stdin.write(composeFiles)
      stdin.end()
    }
    return p
  }

  const spawnCompose = (
    ...args: Parameters<typeof spawnComposeArgs>
  ) => addStdIn(spawn(...spawnComposeArgs(...args)))

  const spawnComposePromise = async (
    ...args: Parameters<typeof spawnComposeArgs>
  ) => await childProcessPromise(spawnCompose(...args))

  const executer: Executer = async ({ args }) => await childProcessStdoutPromise(spawnCompose(args, {}))

  return Object.assign(composeClient(executer, composeFiles), {
    getServiceLogsProcess: (
      service: string,
      opts: Parameters<typeof spawnComposeArgs>[1] = {}
    ) => spawnCompose(['logs', '--no-color', '--no-log-prefix', '--follow', service], opts),
    spawn: spawnCompose,
    spawnPromise: spawnComposePromise,
  })
}
