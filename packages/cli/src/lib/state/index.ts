import path from 'path'
import { NamedSshKeyPair, SshKeyPair } from '../ssh/keypair'
import { SimpleFS } from './fs'

export type PersistentState = {
  sshKeys: {
    read: (name: string) => Promise<NamedSshKeyPair | undefined>
    write: (name: string, keyPair: SshKeyPair) => Promise<void>
  }
}

export const fsState = (fs: SimpleFS): PersistentState => ({
  get sshKeys() {
    const sshKeysDir = 'ssh-keys'
    const privateKeyFile = (name: string) => path.join(sshKeysDir, name, 'id_rsa')
    const publicKeyFile = (name: string) => path.join(sshKeysDir, name, 'id_rsa.pub')
    return {
      read: async (name: string) => {
        const [privateKey, publicKey] = await Promise.all([
          fs.read(privateKeyFile(name)),
          fs.read(publicKeyFile(name)),
        ])

        return privateKey && publicKey ? { name, privateKey, publicKey } : undefined
      },
      write: async (name: string, { publicKey, privateKey }: SshKeyPair) => {
        await Promise.all([
          fs.write(privateKeyFile(name), privateKey),
          fs.write(publicKeyFile(name), publicKey),
        ])
      },
    }
  },
})
