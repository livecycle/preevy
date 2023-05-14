import path from 'path'
import { SSHKeyConfig } from '../ssh/keypair'
import { Store } from '../store'

export const sshKeysStore = (store: Store) => {
  const sshKeysDir = 'ssh-keys'
  const privateKeyFile = (name: string) => path.join(name, 'id_rsa')
  const publicKeyFile = (name: string) => path.join(name, 'id_rsa.pub')
  const ref = store.ref(sshKeysDir)
  return {
    getKey: async (alias: string): Promise<SSHKeyConfig | undefined> => {
      const [privateKey, publicKey] = await Promise.all([
        ref.read(privateKeyFile(alias)),
        ref.read(publicKeyFile(alias)),
      ])
      return privateKey && publicKey ? { alias, privateKey, publicKey } : undefined
    },
    addKey: ({ alias, privateKey, publicKey }: SSHKeyConfig) =>
      store.transaction(sshKeysDir, async ({ write }) => {
        await Promise.all([
          write(privateKeyFile(alias), privateKey),
          write(publicKeyFile(alias), publicKey),
        ])
      }),
    deleteKey: async (alias: string) => store.transaction(sshKeysDir, async ({ delete: del }) => {
      await Promise.all([
        del(privateKeyFile(alias)),
        del(publicKeyFile(alias)),
      ])
    }),
  }
}
