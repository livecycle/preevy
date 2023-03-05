import { NamedSshKeyPair } from '../../ssh/keypair'

export type Machine = {
  providerId: string
  version: string
  publicIPAddress: string
  privateIPAddress: string
  sshKeyName: string
  sshUsername: string
}

export type MachineDriver = {
  getMachine: ({ envId }: { envId: string }) => Promise<Machine | undefined>

  createKeyPair: ({ envId }: { envId: string }) => Promise<NamedSshKeyPair>

  createMachine: (args: {
    envId: string
    keyPairName: string
  }) => Promise<Machine & { fromSnapshot: boolean }>

  ensureMachineSnapshot: ({ providerId, envId }: { providerId: string; envId: string }) => Promise<void>

  listMachines: () => AsyncIterableIterator<Machine & { envId: string }>

  removeMachine: (providerId: string) => Promise<void>

  listKeyPairs: () => AsyncIterableIterator<string>
}
