import path from 'path'
import { rimraf } from 'rimraf'
import { isEmpty, mapValues } from 'lodash'
import { localFs } from '../store/fs/local'
import { Store, VirtualFS, store, tarSnapshot } from '../store'
import { ProfileEditor, profileStore } from './store'
import { Profile } from './profile'

type ProfileListEntry = {
  alias: string
  id: string
  location: string
}

type ProfileList = {
  current: string | undefined
  profiles: Record<string, ProfileListEntry>
}

type PersistedProfileList = {
  current: string | undefined
  profiles: Record<string, Omit<ProfileListEntry, 'alias'>>
}

type GetResult = {
  location: string
  info: Profile
  store: Store
}

export type LocalProfilesConfigGetResult = GetResult

const listPersistence = ({ localDir }: { localDir: string }) => {
  const profileListFileName = 'profileList.json'
  const localStore = localFs(localDir)

  return {
    read: async (): Promise<ProfileList> => {
      const readStr = await localStore.read(profileListFileName)
      if (!readStr) {
        return { current: undefined, profiles: {} }
      }
      const { current, profiles } = JSON.parse(readStr.toString()) as PersistedProfileList
      return {
        current,
        profiles: mapValues(profiles, (v, alias) => ({ ...v, alias })),
      }
    },
    write: async ({ profiles, current }: ProfileList): Promise<void> => {
      const written: PersistedProfileList = {
        current,
        profiles: mapValues(profiles, ({ id, location }) => ({ id, location })),
      }
      await localStore.write(profileListFileName, JSON.stringify(written))
    },
  }
}

export const localProfilesConfig = (
  localDir: string,
  fsFromUrl: (url: string, baseDir: string) => Promise<VirtualFS>,
) => {
  const localProfilesDir = path.join(localDir, 'profiles')
  const storeFromUrl = async (
    url: string,
  ) => store(async dir => await tarSnapshot(await fsFromUrl(url, localProfilesDir), dir))
  const listP = listPersistence({ localDir })

  async function get(alias: string | undefined): Promise<GetResult>
  async function get(alias: string | undefined, opts: { throwOnNotFound: false }): Promise<GetResult>
  async function get(alias: string | undefined, opts: { throwOnNotFound: true }): Promise<GetResult | undefined>
  async function get(alias: string | undefined, opts?: { throwOnNotFound: boolean }): Promise<GetResult | undefined> {
    const throwOrUndefined = () => {
      if (opts?.throwOnNotFound) {
        throw new Error(`Profile ${alias} not found`)
      }
      return undefined
    }

    const { profiles, current } = await listP.read()
    const aliasToGet = alias ?? current
    if (!aliasToGet) {
      return throwOrUndefined()
    }
    const locationUrl = profiles[aliasToGet]?.location
    if (!locationUrl) {
      return throwOrUndefined()
    }
    const tarSnapshotStore = await storeFromUrl(locationUrl)
    const profileInfo = await profileStore(tarSnapshotStore).ref.info()
    return {
      location: locationUrl,
      info: profileInfo,
      store: tarSnapshotStore,
    }
  }

  const create = async (
    alias: string,
    location: string,
    profile: Omit<Profile, 'id'>,
    init: (pe: ProfileEditor) => Promise<void>,
    makeCurrent = false,
  ) => {
    const { profiles, current } = await listP.read()
    if (profiles[alias]) {
      throw new Error(`Profile ${alias} already exists`)
    }
    const id = `${alias}-${Math.random().toString(36).substring(2, 9)}`
    const tar = await storeFromUrl(location)
    const pStore = profileStore(tar)
    await pStore.transaction(async op => {
      await op.info().write({ id, ...profile })
      await init(op)
    })

    profiles[alias] = {
      alias,
      id,
      location,
    }
    await listP.write({ profiles, current: makeCurrent ? alias : current })
    return {
      info: {
        id,
        ...profile,
      },
      store: tar,
    }
  }

  const copy = async (
    source: { location: string },
    target: { alias: string; location: string },
    drivers: string[],
    makeCurrent = false,
  ) => {
    const sourceStore = await storeFromUrl(source.location)
    const sourceProfileStore = profileStore(sourceStore).ref
    const { driver } = await sourceProfileStore.info()
    await create(target.alias, target.location, { driver }, async pe => {
      await pe.tunnelingKey().write(await sourceProfileStore.tunnelingKey())
      if (driver) {
        await pe.driver().write(driver)
      }
      await Promise.all(drivers.map(async sourceDriver => {
        const driverFlags = await sourceProfileStore.defaultDriverFlags(sourceDriver)
        if (!isEmpty(driverFlags)) {
          await pe.defaultDriverFlags(sourceDriver).write(driverFlags)
        }
      }))
    }, makeCurrent)
  }

  return {
    async current(): Promise<ProfileListEntry | undefined> {
      const { profiles, current: currentAlias } = await listP.read()
      return currentAlias ? profiles[currentAlias] : undefined
    },
    async setCurrent(alias: string) {
      const list = await listP.read()
      if (!list.profiles[alias]) {
        throw new Error(`Profile ${alias} doesn't exists`)
      }
      list.current = alias
      await listP.write(list)
    },
    async list(): Promise<ProfileList> {
      return await listP.read()
    },
    get,
    async delete(alias: string, opts: { throwOnNotFound?: boolean } = {}) {
      const list = await listP.read()
      const entry = list.profiles[alias]
      if (!entry) {
        if (opts.throwOnNotFound) {
          throw new Error(`Profile ${alias} does not exist`)
        }
        return false
      }
      delete list.profiles[alias]
      if (list.current === alias) {
        list.current = undefined
      }
      await listP.write(list)
      if (entry.location.startsWith('local://')) {
        await rimraf(path.join(localProfilesDir, alias))
      }
      return true
    },
    async importExisting(alias: string, fromLocation: string, makeCurrent = false): Promise<GetResult> {
      const { profiles, current } = await listP.read()
      if (profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const tarSnapshotStore = await storeFromUrl(fromLocation)
      const info = await profileStore(tarSnapshotStore).ref.info()
      const newProfile = {
        id: info.id,
        alias,
        location: fromLocation,
      }
      profiles[alias] = newProfile
      await listP.write({ profiles, current: makeCurrent ? alias : current })
      return {
        location: fromLocation,
        info,
        store: tarSnapshotStore,
      }
    },
    create,
    copy,
  }
}

export type LocalProfilesConfig = ReturnType<typeof localProfilesConfig>
