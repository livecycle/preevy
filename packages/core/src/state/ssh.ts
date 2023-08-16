import path from 'path'
import { SSHKeyConfig, SshKeyPairType, generateSshKeyPair } from '../ssh/keypair'
import { Store } from '../store'

export const sshKeysStore = (store: Store) => {
  const sshKeysDir = 'ssh-keys'
  const privateKeyFile = (name: string) => path.join(name, 'id_rsa')
  const publicKeyFile = (name: string) => path.join(name, 'id_rsa.pub')
  const ref = store.ref(sshKeysDir)

  const readKey = async (alias: string): Promise<SSHKeyConfig | undefined> => {
    const [privateKey, publicKey] = await Promise.all([
      ref.read(privateKeyFile(alias)),
      ref.read(publicKeyFile(alias)),
    ])
    return privateKey && publicKey ? { alias, privateKey, publicKey } : undefined
  }

  const writeKey = (
    { alias, privateKey, publicKey }: SSHKeyConfig,
  ) => store.transaction(sshKeysDir, async ({ write }) => {
    await Promise.all([
      write(privateKeyFile(alias), privateKey),
      write(publicKeyFile(alias), publicKey),
    ])
  })

  return {
    readKey,
    writeKey,
    upsertKey: async (alias: string, type: SshKeyPairType = 'ed25519') => {
      let storedKeyPair = await readKey(alias)
      if (!storedKeyPair) {
        const newKeyPair = await generateSshKeyPair(type)
        storedKeyPair = { alias, ...newKeyPair }
        await writeKey(storedKeyPair)
      }

      return storedKeyPair.publicKey.toString('utf-8')
    },
    deleteKey: async (alias: string) => await store.transaction(sshKeysDir, async ({ delete: del }) => {
      await Promise.all([
        del(privateKeyFile(alias)),
        del(publicKeyFile(alias)),
      ])
    }),
  }
}
