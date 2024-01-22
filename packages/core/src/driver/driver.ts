import { MachineStatusCommand } from '@preevy/common'
import { PartialStdioOptions } from '../child-process.js'
import { CommandExecuter } from '../command-executer.js'
import { Profile } from '../profile/index.js'
import { MachineBase, PartialMachine, Resource, SpecDiffItem } from './machine-model.js'
import { Store } from '../store/index.js'
import { Logger } from '../log.js'

export type ForwardSocket = AsyncDisposable & {
  address: { host: string; port: number }
}

export type MachineConnection = Disposable & {
  exec: CommandExecuter
  dockerSocket: () => Promise<ForwardSocket>
}

export type MachineDriver<
  Machine extends MachineBase = MachineBase,
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
  machineStatusCommand: (machine: MachineBase) => Promise<MachineStatusCommand | undefined>
}

export type MachineCreationResult<Machine extends MachineBase = MachineBase> = {
  fromSnapshot: boolean
  result: Promise<{ machine: Machine; connection: MachineConnection }>
}

export type MachineCreationDriver<
  Machine extends MachineBase = MachineBase,
  ResourceType extends string = string,
> = {
  metadata: Record<string, unknown>

  createMachine: (args: {
    envId: string
  }) => Promise<MachineCreationResult<Machine>>

  ensureMachineSnapshot: (args: { providerId: string; envId: string; wait: boolean }) => Promise<void>
  getMachineAndSpecDiff: (
    args: { envId: string },
  ) => Promise<(Machine & { specDiff: SpecDiffItem[] }) | PartialMachine | undefined>

  listDeletableResources: () => AsyncIterableIterator<Resource<ResourceType>>
  deleteResources: (wait: boolean, ...resource: Resource<string>[]) => Promise<void>
}

export type MachineDriverFactory<
  Flags,
  Machine extends MachineBase = MachineBase,
> = ({ flags, profile, store, log, debug }: {
  flags: Flags
  profile: Profile
  store: Store
  log: Logger
  debug: boolean
}) => MachineDriver<Machine>

export type MachineCreationDriverFactory<
  Flags,
  Machine extends MachineBase,
  ResourceType extends string = string,
> = ({ flags, profile, store, log, debug }: {
  flags: Flags
  profile: Profile
  store: Store
  log: Logger
  debug: boolean
}) => MachineCreationDriver<Machine, ResourceType>
