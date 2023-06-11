import ssh2, { SFTPWrapper } from 'ssh2'
import path from 'path'
import { promisify } from 'util'
import { pLimit } from '../../limit'
import { DirToCopy, FileToCopy, isDirEnt, normalizeDirInfo, normalizeFileInfo, pathFromStringOrFileInfo } from './files'
import { TransferOptions } from './transfer'

type ErrorCodeHandler<T> = [number, () => T]
const handleCodeError = <T>(...codes: ErrorCodeHandler<T>[]) => (err: unknown) => {
  const { code } = err as { code: number }
  for (const [c, f] of codes) {
    if (code === c) {
      return f()
    }
  }
  throw err
}

const mkdirAlreadyExistsHandler = handleCodeError([ssh2.utils.sftp.STATUS_CODE.FAILURE, () => undefined])

const retryAfterCreatingParentDir = (
  f: () => Promise<void>,
  createParentDir: () => Promise<void>,
): Promise<void> => f().catch(
  handleCodeError([ssh2.utils.sftp.STATUS_CODE.NO_SUCH_FILE, async () => {
    await createParentDir()
    return f()
  }])
)

export const sftpClient = (
  ssh: ssh2.Client
) => async ({ concurrency = 1 }: { concurrency?: number } = {}) => {
  const sftp = await promisify(ssh.sftp.bind(ssh))() as SFTPWrapper & { end: () => void }

  const limit = pLimit(concurrency)

  const promisified = {
    putFile: promisify<string, string, ssh2.TransferOptions>(sftp.fastPut.bind(sftp)),
    mkdir: promisify<string, ssh2.InputAttributes>(sftp.mkdir.bind(sftp)),
    symlink: promisify(sftp.symlink.bind(sftp)),
  }

  const limited = {
    putFile: (...args: Parameters<typeof promisified.putFile>) => limit(promisified.putFile, ...args) as Promise<void>,
    mkdir: (...args: Parameters<typeof promisified.mkdir>) => limit(promisified.mkdir, ...args) as Promise<void>,
    symlink: (...args: Parameters<typeof promisified.symlink>) => limit(promisified.symlink, ...args) as Promise<void>,
  }

  const withParentDir: Pick<typeof limited, 'mkdir' | 'putFile'> = {
    putFile: async (local: string, remote: string, transferOptions: ssh2.TransferOptions) =>
      retryAfterCreatingParentDir(
        () => limited.putFile(local, remote, transferOptions),
        () => withParentDir.mkdir(path.dirname(remote), {}),
      ),

    mkdir: async (remote: string, options: ssh2.InputAttributes): Promise<void> =>
      retryAfterCreatingParentDir(
        () => limited.mkdir(remote, options).catch(mkdirAlreadyExistsHandler),
        () => withParentDir.mkdir(path.dirname(remote), options),
      ),
  }

  const self = {
    mkdir: (remote: string) => withParentDir.mkdir(remote, {}),

    putFile: async ({ local, remote }: FileToCopy, options: TransferOptions = {}): Promise<void> => {
      const fileInfo = await normalizeFileInfo(local)

      options.progress?.emit('file', fileInfo.path)

      if (fileInfo.symlinkTarget) {
        return limited.symlink(fileInfo.symlinkTarget, remote)
      }

      if (fileInfo.stats.isDirectory()) {
        return self.putDirectory({ local: fileInfo, remote }, options)
      }

      const transferOptions: ssh2.TransferOptions = {
        mode: options.mode ?? fileInfo.stats.mode,
        chunkSize: options.chunkSize,
        step: options.progress
          ? (_total, bytes) => options.progress?.emit('bytes', { bytes, file: fileInfo.path })
          : undefined,
      }

      return withParentDir.putFile(fileInfo.path, remote, transferOptions)
    },

    putDirectory: async ({ local, remote }: DirToCopy, options: TransferOptions = {}): Promise<void> => {
      const { entries, path: p } = await normalizeDirInfo(local)

      await self.mkdir(remote)
      options.progress?.emit('file', p)

      await Promise.all([
        ...entries.map(f => self.putFile(
          {
            local: isDirEnt(f) ? path.join(p, f.name) : f,
            remote: path.join(remote, pathFromStringOrFileInfo(f)),
          },
          options,
        )),
      ])

      return undefined
    },

    putFiles: async (files: FileToCopy[], options: TransferOptions = {}): Promise<void> => Promise.all(
      files.map(f => self.putFile(f, options)),
    ).then(() => undefined),

    close: () => sftp.end(),
  }

  return self
}

export type SftpClient = Awaited<ReturnType<ReturnType<typeof sftpClient>>>
