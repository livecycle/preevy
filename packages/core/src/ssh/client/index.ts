import ssh2 from 'ssh2'
import { ListenOptions } from 'net'
import { sftpClient } from './sftp'
import { forwardOutStreamLocal } from './forward-out'
import { execCommand } from './exec'
import { mkdir } from '../../command-executer'
import { Logger } from '../../log'

export { FileToCopy } from './files'

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

  const exec = execCommand(ssh)
  const sftp = sftpClient(ssh)

  const self = {
    mkdir: mkdir(exec),
    sftp,
    execCommand: exec,
    forwardOutStreamLocal: (
      listenAddress: string | number | ListenOptions,
      remoteSocket: string,
    ) => forwardOutStreamLocal({ ssh, log, listenAddress, remoteSocket }),
    dispose: () => ssh.end(),
  }

  return self
}

export type SshClient = Awaited<ReturnType<typeof connectSshClient>>
