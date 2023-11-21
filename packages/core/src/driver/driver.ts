import { MachineStatusCommand } from '@preevy/common'
import { PartialStdioOptions } from '../child-process'
import { CommandExecuter } from '../command-executer'
import { Profile } from '../profile'
import { MachineBase, PartialMachine, Resource, SpecDiffItem } from './machine-model'
import { Store } from '../store'
import { Logger } from '../log'

export type ForwardSocket = AsyncDisposable & {
  address: { host: string; port: number }
}

export type MachineConnection = Disposable & {
  exec: CommandExecuter
  dockerSocket: () => Promise<ForwardSocket>
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
  spawnRemoteCommand: (
    machine: MachineBase,
    command: string[],
    stdio: PartialStdioOptions,
  ) => Promise<{ code: number } | { signal: string }>

  listMachines: () => AsyncIterableIterator<Machine | PartialMachine>
  listDeletableResources: () => AsyncIterableIterator<Resource<ResourceType>>
  deleteResources: (wait: boolean, ...resource: Resource<string>[]) => Promise<void>
  machineStatusCommand: (machine: MachineBase) => Promise<MachineStatusCommand | undefined>
}

export type MachineCreationResult<Machine extends MachineBase = MachineBase> = {
  fromSnapshot: boolean
  result: Promise<{ machine: Machine; connection: MachineConnection }>
}

export type MachineCreationDriver<Machine extends MachineBase = MachineBase> = {
  metadata: Record<string, unknown>

  createMachine: (args: {
    envId: string
  }) => Promise<MachineCreationResult<Machine>>

  ensureMachineSnapshot: (args: { providerId: string; envId: string; wait: boolean }) => Promise<void>
  getMachineAndSpecDiff: (
    args: { envId: string },
  ) => Promise<(Machine & { specDiff: SpecDiffItem[] }) | PartialMachine | undefined>
}

export type MachineDriverFactory<
  Flags,
  Machine extends MachineBase = MachineBase,
  ResourceType extends string = string
> = ({ flags, profile, store, log, debug }: {
  flags: Flags
  profile: Profile
  store: Store
  log: Logger
  debug: boolean
}) => MachineDriver<Machine, ResourceType>

export type MachineCreationDriverFactory<Flags, Machine extends MachineBase> = ({ flags, profile, store, log, debug }: {
  flags: Flags
  profile: Profile
  store: Store
  log: Logger
  debug: boolean
}) => MachineCreationDriver<Machine>
