import { promisify } from 'util'
import childProcess, { spawn, SpawnOptionsWithoutStdio, StdioPipe, StdioPipeNamed } from 'child_process'
import shellEscape from 'shell-escape'
import yaml from 'yaml'
import { ComposeModel } from '../../compose'
import { spawnPromise } from '../../child-process'

const exec = promisify(childProcess.exec)

export const dockerCompose = (...composeFiles: string[]) => {
  const composeFileArgs = composeFiles.flatMap(file => ['-f', file])
  const composeCommand = `docker compose ${shellEscape(composeFileArgs)}`
  const execComposeCommand = async (args: string) => (await exec(`${composeCommand} ${args}`)).stdout.trim()

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
      ...composeFileArgs,
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

  return {
    getModel: async () => yaml.parse(await execComposeCommand('convert')) as ComposeModel,
    getServiceLogs: (service: string) => execComposeCommand(`logs --no-color --no-log-prefix ${service}`),
    getServiceUrl: (service: string, port: number) => execComposeCommand(`port ${service} ${port}`),
    getServiceLogsProcess: (
      service: string,
      opts: Parameters<typeof spawnComposeArgs>[1] = {}
    ) => spawnCompose(['logs', '--no-color', '--no-log-prefix', '--follow', service], opts),
    startService: (...services: string[]) => execComposeCommand(`start ${shellEscape(services)}`),
    spawn: spawnCompose,
    spawnPromise: spawnComposePromise,
  }
}
