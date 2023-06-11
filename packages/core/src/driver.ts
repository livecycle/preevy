import { Profile } from './profile'
import { SSHKeyConfig } from './ssh'

export type PartialMachine = {
  providerId: string
  error?: string
}

export type Machine = {
  version: string
  publicIPAddress: string
  sshKeyName: string
  sshUsername: string
} & PartialMachine

export type SpecDiffItem = {
  name: string
  old: string
  new: string
}

export type MachineDriver = {
  customizationScripts?: string[]
  friendlyName: string

  getMachine: (args: { envId: string }) => Promise<Machine | undefined>

  getKeyPairAlias: () => Promise<string>

  createKeyPair: () => Promise<SSHKeyConfig>

  listMachines: () => AsyncIterableIterator<(Machine|PartialMachine) & { envId: string }>
  listSnapshots: () => AsyncIterableIterator<{ providerId: string }>
  removeMachine: (driverMachineId: string, wait: boolean) => Promise<void>
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
