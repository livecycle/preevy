import { AddressInfo, ListenOptions } from 'net'
import { ChildProcess, StdioOptions } from 'child_process'
import { CommandExecuter } from '../command-executer'
import { Profile } from '../profile'
import { MachineBase, PartialMachine, SpecDiffItem } from './machine'
import { Store } from '../store'
import { Logger } from '../log'

export type ForwardOutStreamLocal = {
  localSocket: string | AddressInfo
  close: () => Promise<void>
}

export type MachineConnection = {
  exec: CommandExecuter
  portForward: (
    listenAddress: string | number | ListenOptions,
    remoteSocket: string,
  ) => Promise<ForwardOutStreamLocal>
  close: () => Promise<void>
}

export type MachineDriver<
  Machine extends MachineBase = MachineBase,
  NonMachineResourceType extends string = string
> = {
  customizationScripts?: string[]
  friendlyName: string

  getMachine: (args: { envId: string }) => Promise<Machine | PartialMachine | undefined>

  connect: (machine: MachineBase, opts: { log: Logger; debug: boolean }) => Promise<MachineConnection>
  spawnRemoteCommand: (machine: MachineBase, command: string[], stdio: StdioOptions) => Promise<ChildProcess>

  listMachines: () => AsyncIterableIterator<(PartialMachine | Machine) & { envId: string }>
  removeMachine: (providerId: string, wait: boolean) => Promise<void>

  listNonMachineResources: () => AsyncIterableIterator<{ type: NonMachineResourceType; providerId: string }>
  removeNonMachineResource: (
    resource: { type: string; providerId: string },
    wait: boolean,
  ) => Promise<void>
  pluralNonMachineResourceType: (type: string) => string
}

export type MachineCreationDriver<Machine extends MachineBase = MachineBase> = {
  createMachine: (args: {
    envId: string
  }) => Promise<{ fromSnapshot: boolean; machine: Promise<Machine> }>

  ensureMachineSnapshot: (args: { driverMachineId: string; envId: string; wait: boolean }) => Promise<void>
  getMachineAndSpecDiff: (
    args: { envId: string },
  ) => Promise<(Machine & { specDiff: SpecDiffItem[] }) | PartialMachine | undefined>
}

export type MachineDriverFactory<
  Flags,
  Machine extends MachineBase = MachineBase,
  ResourceType extends string = string
> = (
  flags: Flags,
  profile: Profile,
  store: Store,
) => MachineDriver<Machine, ResourceType>

export type MachineCreationDriverFactory<Flags, Machine extends MachineBase> = (
  flags: Flags,
  profile: Profile,
  store: Store,
) => MachineCreationDriver<Machine>
