import path from 'path'
import { randomBytes } from 'crypto'
import { CommandExecuter, ExecResult, mkdir } from './command-executer'
import { Logger } from './log'
import { upload } from './upload-files'

export type ScriptExecuter = (
  script: string,
  opts?: { env?: Record<string, string | undefined> },
) => Promise<ExecResult>

export const scriptExecuter = ({ exec, log }: {
  exec: CommandExecuter
  log: Logger
}): ScriptExecuter => async (script, opts = {}) => {
  const scriptFile = path.basename(script)
  const destination = `/tmp/scripts/${scriptFile}.${randomBytes(16).toString('hex')}`
  log.debug(`executing script ${scriptFile} at ${destination}`)
  await mkdir(exec)(destination)
  await upload(exec, destination, [{ local: script, remote: scriptFile }])
  try {
    return await exec(`pwd; env; ./${scriptFile}`, { cwd: destination, env: opts.env })
  } finally {
    await exec(`rm -rf ${destination}`)
  }
}
