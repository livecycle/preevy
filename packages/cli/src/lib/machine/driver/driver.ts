import { NamedSshKeyPair } from '../../ssh/keypair'

export type Machine = {
  providerId: string
  publicIPAddress: string
  privateIPAddress: string
  sshKeyName: string
  sshUsername: string
}

export type CustomizedMachine = Machine & {
  version: string
}

export type MachineDriver = {
  getMachine: ({ envId }: { envId: string }) => Promise<CustomizedMachine | undefined>

  createKeyPair: ({ envId }: { envId: string }) => Promise<NamedSshKeyPair>

  createMachine: (args: {
    envId: string
    keyPairName: string
  }) => Promise<Machine & { fromSnapshot: boolean }>

  onMachineCreated: (
    { providerId, envId, fromSnapshot }: { providerId: string; envId: string; fromSnapshot: boolean },
  ) => Promise<void>

  listMachines: () => AsyncIterableIterator<Machine & { envId: string }>

  removeMachine: (providerId: string) => Promise<void>

  listKeyPairs: () => AsyncIterableIterator<string>
}
