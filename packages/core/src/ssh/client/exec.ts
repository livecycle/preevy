import ssh2 from 'ssh2'
import { readable as isReadableStream } from 'is-stream'
import { orderedOutput } from '@preevy/common'
import { ExecResult, CommandExecuter, commandWith, checkResult, execResultFromOrderedOutput } from '../../command-executer'
import { outputFromStdio } from '../../child-process'

export const execCommand = (
  ssh: ssh2.Client,
): CommandExecuter => async (commandArg, options = {}) => {
  let command = Array.isArray(commandArg) ? commandArg.join(' ') : commandArg
  command = commandWith(command, options)
  command = options.asRoot ? `sudo ${command}` : command
  const stdin = options?.stdin

  const result = await new Promise<ExecResult>((resolve, reject) => {
    ssh.exec(command, {}, (err, channel) => {
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

      const buffers = outputFromStdio(channel)

      channel
        .on('error', reject)
        .on('close', (...[code, signal]: [code: string] | [code: null, signal: string]) => {
          resolve({
            ...execResultFromOrderedOutput(orderedOutput(buffers), options?.encoding),
            ...(code === null || code === undefined ? { signal: signal as string } : { code: Number(code) }),
          })
        })
    })
  })

  return options.ignoreExitCode ? result : checkResult(command, result)
}
