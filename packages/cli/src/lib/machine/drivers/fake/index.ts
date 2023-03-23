import { Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import { SSHKeyConfig } from '../../../ssh/keypair'
import { Machine, MachineDriver } from '../../driver'
import { MachineDriverFactory } from '../../driver/driver'

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

const machineDriver = (_args: { someFlag: string; someFlag2?: string }): MachineDriver => ({
  friendlyName: 'Fake machine',

  getMachine: async () => fakeMachine,

  listMachines: () => asyncMap(x => x, [fakeMachineWithEnvId()]),

  createKeyPair: async () => fakeNamedSshKey,

  createMachine: async () => ({ ...fakeMachine, fromSnapshot: true }),

  ensureMachineSnapshot: async () => undefined,

  removeMachine: async () => undefined,

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

const factory: MachineDriverFactory<Interfaces.InferredFlags<typeof machineDriver.flags>> = (f, _profile) => machineDriver({ someFlag: f['some-flag'] as string, someFlag2: f['some-flag2'] })
machineDriver.factory = factory

export default machineDriver
