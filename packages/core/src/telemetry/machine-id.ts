import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { execPromiseStdout } from '../child-process'

const readFileOrUndefined = (file: string) => fs.promises.readFile(file, 'utf-8').catch(() => undefined)

const macosMachineId = async () => {
  const ioregOutput = await execPromiseStdout('ioreg -d2 -c IOPlatformExpertDevice').catch(() => '')
  const match = /"IOPlatformUUID"\s*=\s*"([^"]+)/.exec(ioregOutput)
  return match?.[1]
}

const linuxMachineId = async () => await readFileOrUndefined('/etc/machine-id') || readFileOrUndefined('/var/lib/dbus/machine-id')

const windowsMachineId = async () => {
  const regOutput = await execPromiseStdout('reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid').catch(() => '')
  const match = /MachineGuid\s+REG_SZ\s+([a-zA-Z0-9-]+)/.exec(regOutput)
  return match?.[1]
}

const machineIdPerPlatform: Partial<Record<NodeJS.Platform, () => Promise<string | undefined>>> = {
  darwin: macosMachineId,
  linux: linuxMachineId,
  win32: windowsMachineId,
}

const calcMachineId = async () => {
  const f = machineIdPerPlatform[os.platform()]
  const id = ((f && await f()) || undefined) || os.hostname()
  return crypto.createHash('sha1').update(id).digest('base64url')
}

export const memoizedMachineId = async (dataDir: string) => {
  const filename = path.join(dataDir, 'machine-id')
  const storedMachineId = await readFileOrUndefined(filename)
  if (storedMachineId) {
    return storedMachineId
  }
  const machineId = await calcMachineId()
  await fs.promises.writeFile(filename, machineId, 'utf-8')
  return machineId
}
