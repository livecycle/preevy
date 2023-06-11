import ssh2 from 'ssh2'
import { readable as isReadableStream } from 'is-stream'
import { inspect } from 'util'
import { ExecResult, CommandExecuter, commandWithCd, commandWithEnv } from '../../command-executer'

export class CommandError extends Error {
  constructor(name: string, field: 'code' | 'signal', value: number | string, result: ExecResult) {
    super(`Error ${field} ${inspect(value)} from command ${name}: ${[result.stdout, result.stderr].join('\n')}`)
  }
}

const checkResult = (name: string, result: ExecResult) => {
  if ('code' in result && result.code !== 0) {
    throw new CommandError(name, 'code', result.code, result)
  }
  if ('signal' in result) {
    throw new CommandError(name, 'signal', result.signal, result)
  }
  return result
}

export const execCommand = (
  ssh: ssh2.Client,
): CommandExecuter => async (command, options = {}) => {
  const commandStr = commandWithEnv(commandWithCd(command, options.cwd), options.env)

  const encoding = options?.encoding ?? 'utf-8'
  const stdin = options?.stdin

  const result = await new Promise<ExecResult>((resolve, reject) => {
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    ssh.exec(commandStr, {}, (err, channel) => {
      if (err) {
        reject(err)
        return
      }

      if (stdin) {
        if (isReadableStream(stdin)) {
          stdin.pipe(channel.stdin, { end: true })
        } else {
          channel.write(stdin)
          channel.end()
        }
      } else {
        channel.end()
      }

      channel
        .on('error', reject)
        .on('close', (...[code, signal]: [code: string] | [code: null, signal: string]) => {
          resolve({
            stdout: Buffer.concat(stdout).toString(encoding),
            stderr: Buffer.concat(stderr).toString(encoding),
            ...(code === null || code === undefined ? { signal: signal as string } : { code: Number(code) }),
          })
        })

      channel.stdout.on('data', (data: Buffer) => { stdout.push(data) })
      channel.stderr.on('data', (data: Buffer) => { stderr.push(data) })
    })
  })

  return options.ignoreExitCode ? result : checkResult(command, result)
}
