import net from 'net'
import { NodeSSH } from 'node-ssh'
import shellEscape from 'shell-escape'
import path from 'path'
import { inspect } from 'util'
import { Logger } from '../../log'
import { randomBytes } from 'crypto'

export type CommandResult = {
  stdout: string, 
  stderr: string, 
  code: number | null
  signal: string | null
}

export type SshClient = {
  dispose(): void
  putDirectory: (local: string, desination: string) => Promise<void>
  putFiles: (rootDir: string, files: string[], destination: string) => Promise<void>
  execCommand(command: string, opts?: {
    cwd?: string
    env?: Record<string, string | undefined>
  }): Promise<CommandResult>
  forwardOutStreamLocal(remoteSocket: string): Promise<{ localSocket: string, close: () => void }>
}

export class CommandError extends Error {
  constructor(name: string, result: CommandResult) {
    super(`Error code ${inspect(result.code)} from command ${name}: ${[result.stdout, result.stderr].join('\n')}`)
  }
}

const checkResult = (name: string, result: CommandResult) => {
  if (result.code !== 0) {
    throw new CommandError(name, result)
  }
  return result
}

export const nodeSshClient = async ({ host, username, privateKey, log }: {
  host: string
  username: string
  privateKey: string
  log: Logger
}): Promise<SshClient> => {
  const ssh = new NodeSSH()
  await ssh.connect({ host, username, privateKey })
  const stepFunc = (total_transferred: number, chunk: number, total: number) => {
    log.debug(`transferred ${total_transferred} of ${total} bytes`)
  }

  return {
    putDirectory: async (local, destination) => {
      await ssh.putDirectory(local, destination, {
        transferOptions: { step: stepFunc },
      })
    },
    putFiles: (rootDir, files, destination) => ssh.putFiles(
      files.map(f => ({ local: path.join(rootDir, f), remote: path.join(destination, f) })), {
        transferOptions: { step: stepFunc },
      },
    ),
    execCommand: async (command, { cwd, env } = {}) => {
      log.debug(`executing ${command}`, { cwd, env })

      // specifying the env at the ssh level may not work, depending on the ssh server
      if (env) {
        const exportCommands = Object.entries(env).map(
          ([key, val]) => `export ${shellEscape([key])}=${shellEscape([val ?? ''])}`
        )
        const exportCommand = exportCommands.join('; ')
        command = `${exportCommand}; ${command}`
      }

      const result = await ssh.execCommand(command, { 
        cwd,
        onStdout: (chunk: Buffer) => log.debug(`stdout: ${chunk.toString()}`),
        onStderr: (chunk: Buffer) => log.debug(`stderr: ${chunk.toString()}`),
      })
      return checkResult(command, result)
    },
    forwardOutStreamLocal: (remoteSocket) => new Promise((resolve, reject) => {
      const { connection } = ssh
      if (!connection) {
        reject(new Error('not connected'))
        return
      }
      const socketServer = net.createServer(socket => {
        connection.openssh_forwardOutStreamLocal(remoteSocket, (err, upstream) => {
          if (err) {
            socket.end()
            socketServer.close()
            reject(err)
            return
          }

          log.debug('piping socket to upstream')
          upstream.pipe(socket).pipe(upstream)
        })
      })

      const socketPath = `/tmp/s_${randomBytes(16).toString('hex')}`

      socketServer
        .listen(socketPath, () => {
          resolve({ localSocket: socketPath, close: () => socketServer.close() })
        })
        .on('error', (err: unknown) => {
          log.error('socketServer error', err)
          socketServer.close()
        })

      connection.on('close', () => {
        log.debug('client close, closing socketServer')
        socketServer.close()
      })
    }),
    dispose: () => ssh.dispose(),
  }
}
