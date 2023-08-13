import stream from 'stream'
import shellEscape from 'shell-escape'
import { inspect } from 'util'
import { OrderedOutput } from '@preevy/common'

export type ExecResult = {
  stdout: string
  stderr: string
  output: string
} & ({ code: number } | { signal: string })

export const execResultFromOrderedOutput = (
  oo: OrderedOutput,
  encoding: BufferEncoding = 'utf-8',
): Pick<ExecResult, 'output' | 'stderr' | 'stdout'> => ({
  get stdout() {
    return oo.stdout().toString(encoding)
  },
  get stderr() {
    return oo.stderr().toString(encoding)
  },
  get output() {
    return oo.output().toString(encoding)
  },
})

export type ExecOptions = {
  cwd?: string
  stdin?: string | Buffer | stream.Readable
  env?: Record<string, string | undefined>
  encoding?: BufferEncoding
  ignoreExitCode?: boolean
  asRoot?: boolean
}

export type CommandExecuter = (command: string, options?: ExecOptions) => Promise<ExecResult>

export class CommandError extends Error {
  constructor(
    readonly command: string,
    field: 'code' | 'signal',
    value: number | string,
    message: string,
  ) {
    super(`Error ${field} ${inspect(value)} from command ${command}: ${message}`)
  }
}

export const checkResult = (command: string, result: ExecResult) => {
  if ('code' in result && result.code !== 0) {
    throw new CommandError(command, 'code', result.code, result.output)
  }
  if ('signal' in result) {
    throw new CommandError(command, 'signal', result.signal, result.output)
  }
  return result
}

const commandWithEnv = (command: string, env: ExecOptions['env']) => [
  ...Object.entries(env ?? {}).map(
    ([key, val]) => `export ${shellEscape([key])}=${shellEscape([val ?? ''])}`
  ),
  command,
].join('; ')

const commandWithCd = (command: string, cwd: ExecOptions['cwd']) => (
  cwd ? `cd ${shellEscape([cwd])}; ${command}` : command
)

const commandWithAsRoot = (command: string, asRoot: ExecOptions['asRoot']) => (
  asRoot ? `su - <<'sueof'\n${command}\nsueof` : command
)

export const commandWith = (
  command: string,
  { env, cwd, asRoot }: Pick<ExecOptions, 'env' | 'cwd' | 'asRoot'>,
) => commandWithAsRoot(commandWithEnv(commandWithCd(command, cwd), env), asRoot)

export const mkdir = (
  exec: CommandExecuter,
) => (...dirs: string[]) => exec(dirs.map(dir => `mkdir -p ${shellEscape([dir])}`).join(' && '))
