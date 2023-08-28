import { AddressInfo } from 'net'
import { MachineStatusCommand } from '@preevy/common'
import { PartialStdioOptions } from '../child-process'
import { CommandExecuter } from '../command-executer'
import { Profile } from '../profile'
import { MachineBase, PartialMachine, Resource, SpecDiffItem } from './machine'
import { Store } from '../store'
import { Logger } from '../log'
import { EnvMachineMetadata } from '../env-metadata'

export type ForwardOutStreamLocal = {
  localSocket: string | AddressInfo
  close: () => Promise<void>
}

export type ForwardSocket = {
  address: { host: string; port: number }
  close: () => Promise<void>
}

export type MachineConnection = {
  exec: CommandExecuter
  dockerSocket: () => Promise<ForwardSocket>
  close: () => Promise<void>
}

export type MachineMetadata = Omit<EnvMachineMetadata, 'machineLocationDescription' | 'driver' | 'providerId'>

export type MachineDriver<
  Machine extends MachineBase = MachineBase,
  ResourceType extends string = string
> = {
  customizationScripts?: string[]
  friendlyName: string
  resourcePlurals: Record<string, string>

  getEnvMachine: (args: { envId: string }) => Promise<Machine | PartialMachine | undefined>

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
  getEnvMachineAndSpecDiff: (
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
