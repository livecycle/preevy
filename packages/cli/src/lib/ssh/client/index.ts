import ssh2 from 'ssh2'
import { sftpClient } from './sftp'
import { Logger } from '../../../log'
import { forwardOutStreamLocal } from './forward-out'
import { lazyTempDir } from '../../files'
import { execCommand } from './exec'
import { mkdir } from './mkdir'
import { scriptExecuter } from './exec-script'

export { ExecResult } from './exec'
export { FileToCopy } from './files'
export { ExpandedTransferProgress } from './progress-expanded'

export const connectSshClient = async (
  { log, debug, ...connectConfig }: Omit<ssh2.ConnectConfig, 'debug'> & { log: Logger; debug: boolean },
) => {
  const ssh = new ssh2.Client()

  await new Promise<void>((resolve, reject) => {
    ssh.on('ready', resolve)
    ssh.on('error', reject)
    ssh.connect({
      algorithms: {
        ...connectConfig.algorithms,
        compress: connectConfig.algorithms?.compress ?? ['zlib@openssh.com', 'zlib', 'none'],
      },
      ...connectConfig,
      debug: debug ? log.debug : undefined,
    })
  })

  const socketDir = lazyTempDir('preview-ssh')

  const exec = execCommand(ssh)
  const sftp = sftpClient(ssh)

  const self = {
    mkdir: mkdir(exec),
    sftp,
    execCommand: exec,
    execScript: scriptExecuter({ execCommand: exec, sftp, log }),
    forwardOutStreamLocal: forwardOutStreamLocal(ssh, log, () => socketDir.path),
    dispose: () => {
      socketDir.dispose()
      ssh.end()
    },
  }

  return self
}

export type SshClient = Awaited<ReturnType<typeof connectSshClient>>
