import stream from 'stream'
import shellEscape from 'shell-escape'

export type ExecResult = {
  stdout: string
  stderr: string
} & ({ code: number } | { signal: string })

export type ExecOptions = {
  cwd?: string
  stdin?: string | Buffer | stream.Readable
  env?: Record<string, string | undefined>
  encoding?: BufferEncoding
  ignoreExitCode?: boolean
}

export type CommandExecuter = (command: string, options?: ExecOptions) => Promise<ExecResult>

export const commandWithEnv = (command: string, env: ExecOptions['env']) => [
  ...Object.entries(env ?? {}).map(
    ([key, val]) => `export ${shellEscape([key])}=${shellEscape([val ?? ''])}`
  ),
  command,
].join('; ')

export const commandWithCd = (command: string, cwd: ExecOptions['cwd']) => (
  cwd ? `cd ${shellEscape([cwd])}; ${command}` : command
)

export const mkdir = (
  exec: CommandExecuter,
) => (...dirs: string[]) => exec(dirs.map(dir => `mkdir -p ${shellEscape([dir])}`).join(' && '))
