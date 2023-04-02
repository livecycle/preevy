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

export type SpecDiffItem = {
  name: string
  old: string
  new: string
}

export type MachineDriver = {
  friendlyName: string

  getMachine: (args: { envId: string }) => Promise<Machine | undefined>

  getKeyPairAlias: () => Promise<string>

  createKeyPair: () => Promise<SSHKeyConfig>

  listMachines: () => AsyncIterableIterator<Machine & { envId: string }>
  listSnapshots: () => AsyncIterableIterator<{ providerId: string }>

  removeMachine: (driverMachineId: string) => Promise<void>
  removeSnapshot: (providerId: string) => Promise<void>
  removeKeyPair: (alias: string) => Promise<void>
}

export type MachineCreationDriver = {
  createMachine: (args: {
    envId: string
    keyConfig: SSHKeyConfig
  }) => Promise<{ fromSnapshot: boolean; machine: Promise<Machine> }>

  ensureMachineSnapshot: (args: { driverMachineId: string; envId: string; wait: boolean }) => Promise<void>

  getMachineAndSpecDiff: (args: { envId: string }) => Promise<(Machine & { specDiff: SpecDiffItem[] }) | undefined>
}

export type MachineDriverFactory<T> = (flags: T, profile: Profile) => MachineDriver
export type MachineCreationDriverFactory<T> = (flags: T, profile: Profile) => MachineCreationDriver
