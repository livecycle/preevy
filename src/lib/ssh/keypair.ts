export type SshKeyPair = {
  privateKey: Buffer | string
  publicKey: Buffer | string
}

export type NamedSshKeyPair = SshKeyPair & { name: string }
