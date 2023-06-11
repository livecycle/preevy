import { AddressInfo, ListenOptions } from 'net'
import { ChildProcess, StdioOptions } from 'child_process'
import { CommandExecuter } from '../command-executer'
import { Profile } from '../profile'
import { MachineBase, PartialMachine, Resource, SpecDiffItem } from './machine'
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
  ResourceType extends string = string
> = {
  customizationScripts?: string[]
  friendlyName: string
  resourcePlurals: Record<string, string>

  getMachine: (args: { envId: string }) => Promise<Machine | PartialMachine | undefined>

  connect: (machine: MachineBase, opts: { log: Logger; debug: boolean }) => Promise<MachineConnection>
  spawnRemoteCommand: (machine: MachineBase, command: string[], stdio: StdioOptions) => Promise<ChildProcess>

  listDeletableResources: () => AsyncIterableIterator<Resource<ResourceType>>
  deleteResources: (wait: boolean, ...resource: Resource<string>[]) => Promise<void>
}

export type MachineCreationDriver<Machine extends MachineBase = MachineBase> = {
  createMachine: (args: {
    envId: string
  }) => Promise<{ fromSnapshot: boolean; machine: Promise<Machine> }>

  ensureMachineSnapshot: (args: { providerId: string; envId: string; wait: boolean }) => Promise<void>
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
