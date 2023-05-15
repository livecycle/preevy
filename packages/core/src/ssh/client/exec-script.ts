import { randomBytes } from 'crypto'
import path from 'path'
import { CommandExecuter, ExecResult } from './exec'
import { SftpClient } from './sftp'
import { Logger } from '../../log'

export type ScriptExecuter = (
  script: string,
  opts?: { env?: Record<string, string | undefined> },
) => Promise<ExecResult>

export const scriptExecuter = ({ execCommand, sftp, log }: {
  execCommand: CommandExecuter
  sftp: () => Promise<SftpClient>
  log: Logger
}): ScriptExecuter => async (script, opts = {}) => {
  const scriptFile = path.basename(script)
  const destination = `/tmp/scripts/${scriptFile}.${randomBytes(16).toString('hex')}`
  log.debug(`executing script ${scriptFile} at ${destination}`)
  const sftpConnection = await sftp()
  try {
    await sftpConnection.putFiles([
      { local: script, remote: path.join(destination, scriptFile) },
    ])
  } finally {
    sftpConnection.close()
  }
  try {
    return await execCommand(`pwd; env; ./${scriptFile}`, { cwd: destination, env: opts.env })
  } finally {
    await execCommand(`rm -rf ${destination}`)
  }
}
