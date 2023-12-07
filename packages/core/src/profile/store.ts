import path from 'path'
import { formatPublicKey } from '@preevy/common'
import { Profile } from './profile'
import { Store, TransactionOp, jsonReader } from '../store'
import { FsReader } from '../store/fs/base'
import { Snapshot } from '../store/snapshot'

const filenames = {
  info: 'info.json',
  driverDefaultFlags: (driver: string) => `${driver}-defaults.json`,
  tunnelingKey: 'tunneling-private-key',
  knownServerPublicKeys: (
    hostname: string,
    port: number | undefined,
  ) => path.join('known-hosts', [hostname, port].filter(Boolean).join('_')),
} as const

export const deleteFile = Symbol('delete')
export type DeleteFile = typeof deleteFile

const readLines = (buffer: Buffer | undefined) => {
  if (!buffer) {
    return []
  }
  return buffer?.toString('utf-8').split('\n').filter(Boolean)
}

const profileReader = (reader: FsReader) => {
  const { readJsonOrThrow, readJSON } = jsonReader(reader)
  const info = async () => await readJsonOrThrow<Profile>(filenames.info)
  return {
    info,
    driver: async () => (await info()).driver,
    defaultDriverFlags: async (
      driver: string,
    ) => await readJSON<Record<string, unknown>>(filenames.driverDefaultFlags(driver)) ?? {},
    tunnelingKey: async () => {
      const tunnelingKey = await reader.read(filenames.tunnelingKey)
      if (!tunnelingKey) {
        throw new Error('Tunneling key is not configured correctly, please recreate the profile')
      }
      return tunnelingKey
    },
    knownServerPublicKeys: async (hostname: string, port: number | undefined) => (
      readLines(await reader.read(filenames.knownServerPublicKeys(hostname, port)))
    ).map(s => Buffer.from(s, 'utf-8')),
  }
}

export type ProfileReader = ReturnType<typeof profileReader>
type ProfileKey = keyof ProfileReader
type ProfileKeyArgs = { [K in ProfileKey]: Parameters<ProfileReader[K]> }
type ProfileKeyValue = { [K in ProfileKey]: Awaited<ReturnType<ProfileReader[K]>> }

export type ProfileEditor = {
  [K in ProfileKey]: (...args: ProfileKeyArgs[K]) => {
    read: () => Promise<ProfileKeyValue[K]>
    write: (val: ProfileKeyValue[K]) => Promise<void>
  }
}

export type ProfileEditorOp<
  T extends ProfileKey = ProfileKey,
  Result = void,
> = (pe: Pick<ProfileEditor, T>) => Promise<Result>

const profileEditor = (
  { read, write }: Pick<Snapshot, 'write' | 'delete' | 'read'>,
): ProfileEditor => {
  const r = profileReader({ read })
  return {
    info: () => ({
      read: r.info,
      write: async (profile: Profile) => {
        if (await read(filenames.info)) {
          throw new Error('Existing profile found in store')
        }
        await write(filenames.info, JSON.stringify(profile))
      },
    }),
    driver: () => ({
      read: r.driver,
      write: async (driver?: string) => await write(filenames.info, JSON.stringify({ ...await r.info(), driver })),
    }),
    defaultDriverFlags: (driver: string) => ({
      read: () => r.defaultDriverFlags(driver),
      write: async (flags: Record<string, unknown>) => await write(
        filenames.driverDefaultFlags(driver),
        JSON.stringify(flags),
      ),
    }),
    tunnelingKey: () => ({
      read: r.tunnelingKey,
      write: async (key: Buffer) => await write(filenames.tunnelingKey, key),
    }),
    knownServerPublicKeys: (hostname: string, port: number | undefined) => ({
      read: () => r.knownServerPublicKeys(hostname, port),
      write: async (newKeys: Buffer[]) => {
        const keys = new Set(readLines(await read(filenames.knownServerPublicKeys(hostname, port))))
        newKeys.forEach(key => keys.add(formatPublicKey(key)))

        await write(filenames.knownServerPublicKeys(hostname, port), [...keys.values()].join('\n'))
      },
    }),
  }
}

const profileDir = 'profile'

export const profileStore = (store: Store) => {
  const storeRef = store.ref(profileDir)
  const storeTransaction = async <T>(op: TransactionOp<T>) => await store.transaction(profileDir, op)

  return {
    ref: profileReader(storeRef),
    transaction: <T>(op: ProfileEditorOp<ProfileKey, T>) => storeTransaction<T>(async o => await op(profileEditor(o))),
  }
}

export type ProfileStore = ReturnType<typeof profileStore>
export type ProfileStoreRef = ProfileStore['ref']
export type ProfileStoreTransaction = ProfileStore['transaction']
