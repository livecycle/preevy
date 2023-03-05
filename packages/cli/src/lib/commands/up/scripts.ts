import { randomBytes } from 'crypto'
import path from 'path'
import { Logger } from '../../../log'
import { scripts } from '../../machine'
import { CommandResult, SshClient } from '../../ssh/client'

export type ScriptExecuter = (
  script: string,
  opts?: { env?: Record<string, string | undefined> },
) => Promise<CommandResult>

const removeFileExtension = (f: string) => f.replace(/\.[^.]+$/, '')

export const scriptExecuter = ({ sshClient, log }: {
  sshClient: SshClient
  log: Logger
}): ScriptExecuter => async (script, opts = {}) => {
  const destination = `/tmp/scripts/${removeFileExtension(script)}.${randomBytes(16).toString('hex')}`
  log.debug(`executing script ${script} at ${destination}`)
  await sshClient.putFiles([
    { local: path.join(scripts.DIR, script), remote: path.join(destination, script) },
  ])
  try {
    return await sshClient.execCommand(`pwd; env; chmod +x ${script} && ./${script}`, { cwd: destination, env: opts.env })
  } finally {
    await sshClient.execCommand(`rm -rf ${destination}`)
  }
}
