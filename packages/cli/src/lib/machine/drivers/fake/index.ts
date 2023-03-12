import { Command, Flags, Interfaces } from '@oclif/core'
import { asyncMap } from 'iter-tools-es'
import { NamedSshKeyPair } from '../../../ssh/keypair'
import { Machine, MachineDriver } from '../../driver'
import { removeDriverPrefix } from '../../driver/flags'

const fakeMachine: Machine = {
  privateIPAddress: '1.1.1.1',
  publicIPAddress: '2.2.2.2',
  providerId: 'fake-provider-id',
  sshKeyName: 'fake-ssh-key',
  sshUsername: 'fake-ssh-user',
}

const fakeMachineWithEnvId = (envId = 'fake-env-id') => ({ ...fakeMachine, envId })

const fakeNamedSshKey: NamedSshKeyPair = {
  name: 'fake-ssh-key',
  publicKey: '',
  privateKey: '',
}

const machineDriver = (_args: { someFlag: string; someFlag2?: string }): MachineDriver => ({
  getMachine: async () => ({ ...fakeMachine, version: 'fake-version' }),

  listMachines: () => asyncMap(x => x, [fakeMachineWithEnvId()]),

  createKeyPair: async () => fakeNamedSshKey,

  createMachine: async () => ({ ...fakeMachine, fromSnapshot: true }),

  onMachineCreated: async () => undefined,

  removeMachine: async () => undefined,

  listKeyPairs: () => asyncMap(x => x, [fakeNamedSshKey.name]),
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

machineDriver.fromFlags = <Command extends typeof Command>(driverName: string, flags: Interfaces.InferredFlags<Command['flags']>) => {
  const f = removeDriverPrefix<Interfaces.InferredFlags<typeof machineDriver.flags>>(driverName, flags)
  return machineDriver({ someFlag: f['some-flag'] as string, someFlag2: f['some-flag2'] })
}

export default machineDriver
