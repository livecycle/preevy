import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { rimraf } from 'rimraf'
import { inspect } from 'util'
import { AddressInfo } from 'net'
import { Store } from '../store'
import { SshKeyPair, connectSshClient } from '../ssh'
import { MachineDriver } from './driver'
import { MachineBase } from './machine'
import { sshKeysStore } from '../state'

export type SshMachine = MachineBase & {
  version: string
  publicIPAddress: string
  sshKeyName: string
  sshUsername: string
}

const isSshMachine = (m: MachineBase): m is SshMachine => 'sshKeyName' in m

const ensureSshMachine = (m: MachineBase): SshMachine => {
  if (!isSshMachine(m)) {
    throw new Error(`Machine ${m.providerId} is not a SshMachine: ${inspect(m)}`)
  }
  return m
}

export const sshDriver = (
  getSshKey: (machine: SshMachine) => Promise<Pick<SshKeyPair, 'privateKey'>>,
): Pick<MachineDriver<SshMachine>, 'connect' | 'spawnRemoteCommand'> => {
  const getPrivateKey = async (machine: SshMachine) => (await getSshKey(machine)).privateKey.toString('utf-8')

  return {
    connect: async (m, { log, debug }) => {
      const machine = ensureSshMachine(m)
      const connection = await connectSshClient({
        log,
        debug,
        host: machine.publicIPAddress,
        username: machine.sshUsername,
        privateKey: await getPrivateKey(machine),
      })

      return {
        close: async () => connection.close(),
        exec: connection.exec,
        dockerSocket: async () => {
          const host = '0.0.0.0'
          const forward = await connection.forwardOutStreamLocal({ port: 0, host }, '/var/run/docker.sock')
          return {
            close: forward.close,
            address: { host, port: (forward.localSocket as AddressInfo).port },
          }
        },
      }
    },
    spawnRemoteCommand: async (m, command, stdio) => {
      const machine = ensureSshMachine(m)
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'preevy-ssh-key-'))
      const privateKeyFilename = path.join(tempDir, machine.providerId)
      await fs.promises.writeFile(privateKeyFilename, await getPrivateKey(machine), { mode: 0o400, flag: 'w' })

      const sshArgs = [
        '-i', privateKeyFilename,
        `${machine.sshUsername}@${machine.publicIPAddress}`,
        ...command,
      ]

      const sshProcess = spawn('ssh', sshArgs, { stdio })
      sshProcess.on('exit', () => rimraf(tempDir))
      return sshProcess
    },
  }
}

export const getStoredKeyOrUndefined = (store: Store, alias: string) => {
  const keyStore = sshKeysStore(store)
  return keyStore.readKey(alias)
}

export const getStoredKey = async (store: Store, alias: string) => {
  const result = await getStoredKeyOrUndefined(store, alias)
  if (!result) {
    throw new Error(`Could not find SSH key for ${alias}`)
  }
  return result
}
