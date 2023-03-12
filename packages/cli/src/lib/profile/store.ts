import path from 'path'
import { parseKey } from '@livecycle/docker-proxy'
import { Profile } from './types'
import { Store } from '../store'

export const profileStore = (store: Store) => {
  const profileDir = 'profile'
  const ref = store.ref(profileDir)

  return {
    async init(profile: Profile) {
      await store.transaction(profileDir, async ({ write }) => {
        await write('info.json', JSON.stringify(profile))
      })
    },
    info: async () => ref.readJsonOrThrow<Profile>('info.json'),
    defaultFlags: async<T>(driver: string) => {
      const profile = await ref.readJSON<T>(`${driver}-defaults.json`)
      if (!profile) {
        return {}
      }
      return profile ?? {}
    },
    setDefaultFlags: async <T extends object>(driver:string, flags:T) => {
      await store.transaction(profileDir, async ({ write }) => {
        await write(`${driver}-defaults.json`, JSON.stringify(flags))
      })
    },
    setTunnelingKey: async (privateKey: Buffer) => {
      await store.transaction(profileDir, async ({ write }) => {
        await write('tunneling-private-key', privateKey)
      })
    },
    getTunnelingKey: () => ref.read('tunneling-private-key').then(x => x?.toString('utf-8')),
    get knownServerPublicKeys() {
      const filename = (
        hostname: string,
        port: number | undefined,
      ) => path.join('known-hosts', [hostname, port].filter(Boolean).join('_'))

      const readStrings = async (hostname: string, port: number | undefined) => {
        const lines = ((await ref.read(filename(hostname, port))) ?? Buffer.from([])).toString('utf-8')
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
          await store.transaction(profileDir, ({ write }) => write(filename(hostname, port), [...keys.values()].join('\n')))
        },
      }
    },
  }
}

export type ProfileStore = ReturnType<typeof profileStore>
