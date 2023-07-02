import path from 'path'
import { formatPublicKey } from '@preevy/common'
import { Profile } from './profile'
import { Store } from '../store'

export const profileStore = (store: Store) => {
  const profileDir = 'profile'
  const ref = store.ref(profileDir)

  return {
    async init(profile: Profile) {
      await store.transaction(profileDir, async ({ write, read }) => {
        if (await read('info.json')) {
          throw new Error('Existing profile found in store')
        }
        await write('info.json', JSON.stringify(profile))
      })
    },
    info: async () => await ref.readJsonOrThrow<Profile>('info.json'),
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
    getTunnelingKey: async () => {
      const tunnelingKey = await ref.read('tunneling-private-key')
      if (!tunnelingKey) {
        throw new Error('Tunneling key is not configured correctly, please recreate the profile')
      }
      return tunnelingKey
    },
    get knownServerPublicKeys() {
      const filename = (
        hostname: string,
        port: number | undefined,
      ) => path.join('known-hosts', [hostname, port].filter(Boolean).join('_'))

      const readLines = (buffer: Buffer | undefined) => {
        if (!buffer) {
          return []
        }
        return buffer?.toString('utf-8').split('\n').filter(Boolean)
      }

      return {
        read: async (hostname: string, port: number | undefined) => (
          readLines(await ref.read(filename(hostname, port)))
        ).map(s => Buffer.from(s, 'utf-8')),

        write: async (hostname: string, port: number | undefined, ...newKeys: Buffer[]) => {
          await store.transaction(profileDir, async ({ write, read }) => {
            const keys = new Set(readLines(await read(filename(hostname, port))))
            newKeys.forEach(key => keys.add(formatPublicKey(key)))

            await write(filename(hostname, port), [...keys.values()].join('\n'))
          })
        },
      }
    },
  }
}

export type ProfileStore = ReturnType<typeof profileStore>
