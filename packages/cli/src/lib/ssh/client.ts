import fs from 'fs'
import net from 'net'
import { NodeSSH } from 'node-ssh'
import shellEscape from 'shell-escape'
import path from 'path'
import { inspect } from 'util'
import { Logger } from '../../log'
import { randomBytes } from 'crypto'
import rimraf from 'rimraf'
import { SFTPWrapper } from 'ssh2'
import { asyncReduce } from 'iter-tools-es'
import { partition } from 'lodash'

export type CommandResult = {
  stdout: string, 
  stderr: string, 
  code: number | null
  signal: string | null
}

export type FileToCopy = { local: string, remote: string }

export type SshClient = {
  dispose(): void
  putDirectory: (local: string, desination: string) => Promise<void>
  putFiles: (files: FileToCopy[]) => Promise<void>
  execCommand(command: string, opts?: {
    cwd?: string
    env?: Record<string, string | undefined>
  }): Promise<CommandResult>
  forwardOutStreamLocal(
    remoteSocket: string, 
    opts?: { localDir?: string },
  ): Promise<{ localSocket: string, close: () => void }>
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

  await ssh.connect({ host, username, privateKey, /* debug: log.debug */ })
  const stepFunc = (total_transferred: number, chunk: number, total: number) => {
    log.debug(`transferred ${total_transferred} of ${total} bytes`)
  }
  let sftp: SFTPWrapper | undefined

  return {
    putDirectory: async (local, destination) => {
      await ssh.putDirectory(local, destination, {
        transferOptions: { step: stepFunc },
      })
    },

    putFiles: async paths => {
      const stats: Record<string, fs.Stats> = Object.fromEntries(
        await Promise.all(paths.map(async ({ local }) => [local, await fs.promises.stat(local)]))
      )
      const [dirs, files] = partition(paths, ({ local }) => stats[local].isDirectory())

      const baseRemoteDirs = [...new Set(paths.map(({ remote }) => path.dirname(remote)))]
      await ssh.execCommand(baseRemoteDirs.map(dir => `mkdir -p "${dir}"`).join(' && '))

      await Promise.all([
        ssh.putFiles(files, { transferOptions: { step: stepFunc } }),
        ...dirs.map(({ local, remote }) => ssh.putDirectory(local, remote, { transferOptions: { step: stepFunc } })),
      ])
    },
    
    execCommand: async (command, { cwd, env } = {}) => {
      log.debug(`executing command`, { command, cwd, env })

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
    
    forwardOutStreamLocal: (remoteSocket, opts = {}) => new Promise((resolve, reject) => {
      const localDir = opts.localDir ?? '/tmp'
      const { connection } = ssh
      if (!connection) {
        reject(new Error('forwardOutStreamLocal: not connected'))
        return
      }

      const socketServer = net.createServer(socket => {
        connection.openssh_forwardOutStreamLocal(remoteSocket, (err, upstream) => {
          if (err) {
            log.error('openssh_forwardOutStreamLocal error', err)
            socket.end()
            socketServer.close()
            reject(err)
            return
          }

          upstream.pipe(socket).pipe(upstream)
        })
      })

      const socketPath = path.join(localDir, `s_${randomBytes(16).toString('hex')}`)

      const onConnectionClose = () => {
        log.debug('client close, closing socketServer')
        socketServer.close()
      }

      socketServer
        .listen(socketPath, () => {
          resolve({ localSocket: socketPath, close: () => socketServer.close() })
        })
        .on('error', (err: unknown) => {
          log.error('socketServer error', err)
          socketServer.close()
        })
        .on('close', () => {
          log.debug('socketServer closed')
          connection.removeListener('close', onConnectionClose)
          rimraf(socketPath)
        })

      connection.on('close', onConnectionClose)
    }),
    dispose: () => ssh.dispose(),
  }
}
