import path from 'path'
import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { spawn } from 'child_process'
import { rimraf } from 'rimraf'
import { MachineDriver } from '../../machine'
import { SshKeyPair } from '../../ssh/keypair'
import { Logger } from '../../../log'

const ssh = async ({
  envId,
  args,
  dataDir,
  machineDriver,
  sshKeyPair,
}: {
  envId: string
  args: string[]
  dataDir: string
  machineDriver: MachineDriver
  sshKeyPair: SshKeyPair
  log: Logger
}) => {
  const machine = await machineDriver.getMachine({ envId })
  if (!machine) {
    throw new Error(`Machine ${envId} not found`)
  }
  const keyDirBase = path.join(dataDir, 'interactive-ssh-keys', envId)
  await mkdir(keyDirBase, { recursive: true })
  const keyDir = await mkdtemp(`${keyDirBase}${path.sep}`)
  await Promise.all([
    writeFile(path.join(keyDir, 'id_rsa'), sshKeyPair.privateKey, { mode: 0o400, flag: 'w' }),
    writeFile(path.join(keyDir, 'id_rsa.pub'), sshKeyPair.publicKey, { mode: 0o400, flag: 'w' }),
  ])

  const sshArgs = [
    '-i', path.join(keyDir, 'id_rsa'),
    `${machine.sshUsername}@${machine.publicIPAddress}`,
    ...args,
  ]

  return new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    const sshProcess = spawn('ssh', sshArgs, { stdio: 'inherit' })
    sshProcess.on('error', reject)
    sshProcess.on('exit', (code, signal) => resolve({ code, signal }))
  }).finally(() => rimraf(keyDirBase))
}

export default ssh
