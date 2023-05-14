import { Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import { SSHKeyConfig } from '../../ssh/keypair'
import { Machine, MachineDriver, MachineCreationDriver, MachineCreationDriverFactory, MachineDriverFactory } from '../../driver'

const fakeMachine: Machine = {
  privateIPAddress: '1.1.1.1',
  publicIPAddress: '2.2.2.2',
  providerId: 'fake-provider-id',
  sshKeyName: 'fake-ssh-key',
  sshUsername: 'fake-ssh-user',
  version: 'fake-version',
}

const fakeMachineWithEnvId = (envId = 'fake-env-id') => ({ ...fakeMachine, envId })

const fakeNamedSshKey: SSHKeyConfig = {
  alias: 'fake-ssh-key',
  publicKey: '',
  privateKey: '',
}

type DriverContext = {
  someFlag: string
  someFlag2?: string
}

type MachineCreationDriverContext = DriverContext & {
  machineCreationFlag1: string
}

const machineDriver = (_args: DriverContext): MachineDriver => ({
  friendlyName: 'Fake machine',

  getMachine: async () => fakeMachine,

  listMachines: () => asyncMap(x => x, [fakeMachineWithEnvId()]),
  listSnapshots: () => asyncMap(x => x, []),

  createKeyPair: async () => fakeNamedSshKey,

  removeMachine: async () => undefined,
  removeSnapshot: async () => undefined,
  removeKeyPair: async () => undefined,

  getKeyPairAlias: async () => fakeNamedSshKey.alias,
})

machineDriver.flags = {
  'some-flag': Flags.string({
    description: 'Fake flag',
    required: false,
    hidden: true,
  }),
  'some-flag2': Flags.string({
    description: 'Fake flag 2',
    required: false,
    hidden: true,
  }),
} as const

machineDriver.questions = async () => []
machineDriver.flagsFromAnswers = async (answers: Record<string, unknown>) => ({
  'some-flag': answers['some-flag'],
  'some-flag2': answers['some-flag2'],
})

const contextFromFlags = (flags: Interfaces.InferredFlags<typeof machineDriver.flags>): DriverContext => ({
  someFlag: flags['some-flag'] as string,
  someFlag2: flags['some-flag2'] as string,
})

const machineCreationDriver = (_args: MachineCreationDriverContext): MachineCreationDriver => ({
  createMachine: async () => ({ fromSnapshot: true, machine: Promise.resolve(fakeMachine) }),
  ensureMachineSnapshot: async () => undefined,
  getMachineAndSpecDiff: async () => ({ ...fakeMachine, specDiff: [] }),
})

machineDriver.machineCreationFlags = {
  ...machineDriver.flags,
  'machine-creation-flag1': Flags.string({
    description: 'Fake machine creation flag',
    required: false,
    hidden: true,
  }),
} as const

const machineCreationContextFromFlags = (
  flags: Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>
): MachineCreationDriverContext => ({
  ...contextFromFlags(flags),
  machineCreationFlag1: flags['machine-creation-flag1'] as string,
})

const factory: MachineDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.flags>
> = (f, _profile) => machineDriver(contextFromFlags(f))
machineDriver.factory = factory

const machineCreationFactory: MachineCreationDriverFactory<
  Interfaces.InferredFlags<typeof machineDriver.machineCreationFlags>
> = (f, _profile) => machineCreationDriver(machineCreationContextFromFlags(f))

machineDriver.machineCreationFactory = machineCreationFactory

export default machineDriver
