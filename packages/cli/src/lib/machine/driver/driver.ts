import { Profile } from '../../profile/types'
import { SSHKeyConfig } from '../../ssh/keypair'

export type Machine = {
  providerId: string
  version: string
  publicIPAddress: string
  privateIPAddress: string
  sshKeyName: string
  sshUsername: string
}

export type MachineDriver = {
  friendlyName: string

  getMachine: (args: { envId: string }) => Promise<Machine | undefined>

  getKeyPairAlias: () => Promise<string>

  createKeyPair: () => Promise<SSHKeyConfig>

  createMachine: (args: {
    envId: string
    keyConfig: SSHKeyConfig
  }) => Promise<Machine & { fromSnapshot: boolean }>

  ensureMachineSnapshot: (args: { driverMachineId: string; envId: string; wait: boolean }) => Promise<void>

  listMachines: () => AsyncIterableIterator<Machine & { envId: string }>

  removeMachine: (driverMachineId: string) => Promise<void>
}

export type MachineDriverFactory<T> = (flags: T, profile: Profile) => MachineDriver
