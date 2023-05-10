import { ChildProcess, spawn, StdioOptions } from 'child_process'
import yaml from 'yaml'
import { WriteStream } from 'fs'
import { RequiredProperties, hasPropertyDefined } from '@preevy/common'
import { ComposeModel, ComposeService } from './model'
import { childProcessPromise, childProcessStdoutPromise, ProcessError } from '../child-process'

const DOCKER_COMPOSE_NO_CONFIGURATION_FILE_ERROR_CODE = 14

const isExposedService = (x: [string, ComposeService]): x is [string, RequiredProperties<ComposeService, 'ports'>] => hasPropertyDefined(x[1], 'ports')
const getExposedServices = (model: ComposeModel) => Object.entries(model.services ?? []).filter(isExposedService)

export const getExposedTcpServices = (model: ComposeModel) => getExposedServices(model)
  .flatMap(x => x[1].ports
    .map(k => [x[0], k] as const))
  .filter(x => x[1].protocol === 'tcp')
  .map(x => [x[0], x[1].target] as const)

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
  const execComposeCommand = (args: string[]) => executer({
    args,
    stdin: Buffer.isBuffer(composeFiles) ? composeFiles : undefined,
  })

  // if we don't use --no-interpolate, then the convert command will replace the env vars with empty strings
  // we need to keep the environment variables in the yaml file, so we can support service discovery using preevy
  // build time environment variables https://github.com/livecycle/preevy/issues/57
  // https://github.com/docker/compose/pull/9703
  const getModel = async () => yaml.parse(await execComposeCommand(['convert', '--no-interpolate'])) as ComposeModel

  return {
    getModel,
    getModelOrUndefined: async () => getModel().catch(e => {
      if (e instanceof ProcessError && e.code === DOCKER_COMPOSE_NO_CONFIGURATION_FILE_ERROR_CODE) {
        return undefined
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

export const localComposeClient = (composeFiles: string[] | Buffer, projectName?: string) => {
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

  const spawnComposeArgs = (...[args, opts]: ParametersExceptFirst<typeof spawn>): Parameters<typeof spawn> => [
    'docker',
    [
      'compose',
      ...composeFileArgs(composeFiles, projectName),
      ...args,
    ],
    {
      ...opts,
      env: {
        ...process.env,
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

  const spawnComposePromise = (
    ...args: Parameters<typeof spawnComposeArgs>
  ) => childProcessPromise(spawnCompose(...args))

  const executer: Executer = ({ args }) => childProcessStdoutPromise(spawnCompose(args, {}))

  return Object.assign(composeClient(executer, composeFiles), {
    getServiceLogsProcess: (
      service: string,
      opts: Parameters<typeof spawnComposeArgs>[1] = {}
    ) => spawnCompose(['logs', '--no-color', '--no-log-prefix', '--follow', service], opts),
    spawn: spawnCompose,
    spawnPromise: spawnComposePromise,
  })
}
