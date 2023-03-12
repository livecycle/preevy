import fs from 'fs'
import net from 'net'
import { NodeSSH } from 'node-ssh'
import shellEscape from 'shell-escape'
import path from 'path'
import { inspect } from 'util'
import { randomBytes } from 'crypto'
import rimraf from 'rimraf'
import { partition } from 'lodash'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { Logger } from '../../log'

export type CommandResult = {
  stdout: string
  stderr: string
  code: number | null
  signal: string | null
}

export type FileToCopy = {
  local: string | { path: string; stats: fs.Stats }
  remote: string
}

const normalizeFileToCopy = async ({ local, remote }: FileToCopy) => ({
  local: typeof local === 'string' ? { path: local, stats: await fs.promises.stat(local) } : local,
  remote,
})

export type SshClient = {
  dispose(): void
  putDirectory: (local: string, desination: string) => Promise<void>
  putFiles: (files: FileToCopy[]) => Promise<void>
  execCommand(command: string, opts?: {
    cwd?: string
    env?: Record<string, string | undefined>
    ignoreExitCode?: boolean
  }): Promise<CommandResult>
  forwardOutStreamLocal(
    remoteSocket: string,
    opts?: { localDir?: string },
  ): Promise<{ localSocket: string; close: () => void }>
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

  await ssh.connect({ host, username, privateKey /* debug: log.debug */ })
  const stepFunc = (totalTransferred: number, chunk: number, total: number) => {
    log.debug(`transferred ${totalTransferred} of ${total} bytes`)
  }

  return {
    putDirectory: async (local, destination) => {
      await ssh.putDirectory(local, destination, {
        transferOptions: { step: stepFunc },
      })
    },

    putFiles: async paths => {
      const normalizedPaths = await asyncToArray(asyncMap(normalizeFileToCopy, paths))

      const [dirs, files] = partition(normalizedPaths, ({ local: { stats } }) => stats.isDirectory())

      const baseRemoteDirs = [...new Set(paths.map(({ remote }) => path.dirname(remote)))]
      await ssh.execCommand(baseRemoteDirs.map(dir => `mkdir -p "${dir}"`).join(' && '))

      await Promise.all([
        ssh.putFiles(
          files.map(({ local: { path: local }, remote }) => ({ local, remote })),
          { transferOptions: { step: stepFunc, concurrency: 2 } },
        ),
        ...dirs.map(({ local, remote }) => ssh.putDirectory(
          local.path,
          remote,
          { transferOptions: { step: stepFunc }, concurrency: 2 },
        )),
      ])
    },

    execCommand: async (command, { cwd, env, ignoreExitCode } = {}) => {
      log.debug('executing command', { command, cwd, env })

      // specifying the env at the ssh level may not work, depending on the ssh server
      let commandWithEnv = command
      if (env) {
        const exportCommands = Object.entries(env).map(
          ([key, val]) => `export ${shellEscape([key])}=${shellEscape([val ?? ''])}`
        )
        const exportCommand = exportCommands.join('; ')
        commandWithEnv = `${exportCommand}; ${command}`
      }

      const result = await ssh.execCommand(commandWithEnv, {
        cwd,
        onStdout: (chunk: Buffer) => log.debug(`stdout: ${chunk.toString()}`),
        onStderr: (chunk: Buffer) => log.debug(`stderr: ${chunk.toString()}`),
      })
      return ignoreExitCode ? result : checkResult(command, result)
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
        .on('close', async () => {
          log.debug('socketServer closed')
          connection.removeListener('close', onConnectionClose)
          await rimraf(socketPath)
        })

      process.on('exit', () => rimraf(socketPath))

      connection.on('close', onConnectionClose)
    }),
    dispose: () => ssh.dispose(),
  }
}
