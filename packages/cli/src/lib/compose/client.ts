import { spawn, SpawnOptionsWithoutStdio, StdioPipe, StdioPipeNamed } from 'child_process'
import shellEscape from 'shell-escape'
import yaml from 'yaml'
import { ComposeModel } from './model'
import { execPromiseStdout, spawnPromise } from '../child-process'
import { SshClient } from '../ssh/client'

const composeFileArgs = (composeFiles: string[]) => composeFiles.flatMap(file => ['-f', file])

const composeClient = (
  executer: (command: string) => Promise<string>,
  ...composeFiles: string[]
) => {
  const composeCommand = `docker compose ${shellEscape(composeFileArgs(composeFiles))}`
  const execComposeCommand = (args: string) => executer(`${composeCommand} ${args}`)

  const getModel = async () => yaml.parse(await execComposeCommand('convert')) as ComposeModel

  return {
    startService: (...services: string[]) => execComposeCommand(`start ${shellEscape(services)}`),
    getModel,
    getModelName: async () => (await getModel()).name,
    getServiceLogs: (service: string) => execComposeCommand(`logs --no-color --no-log-prefix ${service}`),
    getServiceUrl: (service: string, port: number) => execComposeCommand(`port ${service} ${port}`),
  }
}

export type ComposeClient = ReturnType<typeof composeClient>

export const localComposeClient = (composeFiles: string[]) => {
  const spawnComposeArgs = (
    args: string[],
    opts: Partial<{
      env: Record<string, string | undefined>
      stdio: StdioPipeNamed | StdioPipe[] | 'inherit'
      opts: SpawnOptionsWithoutStdio
    }> = {}
  ): Parameters<typeof spawn> => [
    'docker',
    [
      'compose',
      ...composeFileArgs(composeFiles),
      ...args,
    ],
    {
      ...opts,
      env: {
        ...process.env,
        ...opts.env,
      },
    },
  ]

  const spawnCompose = (
    ...args: Parameters<typeof spawnComposeArgs>
  ) => spawn(...spawnComposeArgs(...args))

  const spawnComposePromise = (
    ...args: Parameters<typeof spawnComposeArgs>
  ) => spawnPromise(...spawnComposeArgs(...args))

  return Object.assign(composeClient(execPromiseStdout, ...composeFiles), {
    getServiceLogsProcess: (
      service: string,
      opts: Parameters<typeof spawnComposeArgs>[1] = {}
    ) => spawnCompose(['logs', '--no-color', '--no-log-prefix', '--follow', service], opts),
    spawn: spawnCompose,
    spawnPromise: spawnComposePromise,
  })
}

export const sshComposeClient = (
  sshClient: SshClient,
  ...composeFiles: string[]
) => composeClient(
  async (command: string) => (await sshClient.execCommand(command)).stdout.trim(),
  ...composeFiles
)
