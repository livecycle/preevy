import { parseKey } from '@livecycle/docker-proxy'
import path from 'path'
import { NamedSshKeyPair, SshKeyPair } from '../ssh/keypair'
import { SimpleFS } from './fs'

export type PersistentState = {
  machineSshKeys: {
    read: (name: string) => Promise<NamedSshKeyPair | undefined>
    write: (name: string, keyPair: SshKeyPair) => Promise<void>
  }
  knownServerPublicKeys: {
    read: (hostname: string, port: number | undefined) => Promise<Buffer[]>
    write: (hostname: string, port: number | undefined, ...publicKeys: Buffer[]) => Promise<void>
  }
  tunnelKeyPair: {
    read: () => Promise<{ privateKey: string; publicKey: string } | undefined>
    write: (pair: { privateKey: string; publicKey: string }) => Promise<void>
  }
}

export const fsState = (fs: SimpleFS): PersistentState => ({
  get machineSshKeys() {
    const sshKeysDir = 'machine-ssh-keys'
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
  get knownServerPublicKeys() {
    const filename = (
      hostname: string,
      port: number | undefined,
    ) => path.join('known-hosts', [hostname, port].filter(Boolean).join('_'))

    const readStrings = async (hostname: string, port: number | undefined) => {
      const lines = ((await fs.read(filename(hostname, port))) ?? Buffer.from([])).toString('utf-8')
      return lines.split('\n').filter(Boolean)
    }

    const publicKeyToString = (publicKey: Buffer) => {
      const parsed = parseKey(publicKey)
      return `${parsed.type} ${parsed.getPublicSSH().toString('base64')}`
    }

    return {
      read: async (hostname: string, port: number | undefined) => (
        await readStrings(hostname, port)
      ).map(s => Buffer.from(s, 'utf-8')),

      write: async (hostname: string, port: number | undefined, ...newKeys: Buffer[]) => {
        const keys = new Set(await readStrings(hostname, port))
        newKeys.forEach(key => keys.add(publicKeyToString(key)))
        await fs.write(filename(hostname, port), [...keys.values()].join('\n'))
      },
    }
  },
  get tunnelKeyPair() {
    return {
      read: async () => {
        const [privateKey, publicKey] = (await Promise.all([
          fs.read('tunnel-key'),
          fs.read('tunnel-key.pub'),
        ])).map(b => b?.toString('utf-8'))
        if (!privateKey || !publicKey) {
          return undefined
        }
        return { privateKey, publicKey }
      },
      write: async ({ privateKey, publicKey }: { privateKey: string; publicKey: string }) => {
        await Promise.all([
          fs.write('tunnel-key', privateKey),
          fs.write('tunnel-key.pub', publicKey),
        ])
      },
    }
  },
})
