import path from 'path'
import { localFs } from '../store/fs/local'
import { VirtualFS, store, tarSnapshot } from '../store'
import { ProfileStore, profileStore } from './store'
import { Profile } from './profile'

type ProfileListing = {
  alias: string
  id: string
  location: string
}

type ProfileList = {
  current: string | undefined
  profiles: Record<string, Omit<ProfileListing, 'alias'>>
}

const profileListFileName = 'profileList.json'

export const localProfilesConfig = (
  localDir: string,
  fsFromUrl: (url: string, baseDir: string) => Promise<VirtualFS>,
) => {
  const localStore = localFs(localDir)
  const tarSnapshotFromUrl = async (
    url: string,
  ) => store(async dir => await tarSnapshot(await fsFromUrl(url, path.join(localDir, 'profiles')), dir))

  async function readProfileList(): Promise<ProfileList> {
    const data = await localStore.read(profileListFileName)
    if (!data) {
      const initData = { current: undefined, profiles: {} }
      await localStore.write(profileListFileName, JSON.stringify(initData))
      return initData
    }
    return JSON.parse(data.toString())
  }

  return {
    async current() {
      const { profiles, current: currentAlias } = await readProfileList()
      const current = currentAlias && profiles[currentAlias]
      if (!current) {
        return undefined
      }
      return {
        alias: currentAlias,
        id: current.id,
        location: current.location,
      }
    },
    async setCurrent(alias: string) {
      const list = await readProfileList()
      if (!list.profiles[alias]) {
        throw new Error(`Profile ${alias} doesn't exists`)
      }
      list.current = alias
      await localStore.write(profileListFileName, JSON.stringify(list))
    },
    async list(): Promise<ProfileListing[]> {
      return Object.entries((await readProfileList()).profiles).map(([alias, profile]) => ({ alias, ...profile }))
    },
    async get(alias: string) {
      const { profiles } = await readProfileList()
      const locationUrl = profiles[alias]?.location
      if (!locationUrl) {
        throw new Error(`Profile ${alias} not found`)
      }
      const tarSnapshotStore = await tarSnapshotFromUrl(locationUrl)
      const profileInfo = await profileStore(tarSnapshotStore).info()
      return {
        info: profileInfo,
        store: tarSnapshotStore,
      }
    },
    async delete(alias: string) {
      const list = await readProfileList()
      if (!list.profiles[alias]) {
        throw new Error(`Profile ${alias} does not exist`)
      }
      delete list.profiles[alias]
      if (list.current === alias) {
        list.current = undefined
      }
      await localStore.write(profileListFileName, JSON.stringify(list))
    },
    async importExisting(alias: string, location: string) {
      const list = await readProfileList()
      if (list.profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const tarSnapshotStore = await tarSnapshotFromUrl(location)
      const info = await profileStore(tarSnapshotStore).info()
      list.profiles[alias] = {
        id: info.id,
        location,
      }
      list.current = alias
      await localStore.write(profileListFileName, JSON.stringify(list))
      return {
        info,
        store: tarSnapshotStore,
      }
    },
    async create(alias: string, location: string, profile: Omit<Profile, 'id'>, init: (store: ProfileStore) => Promise<void>) {
      const list = await readProfileList()
      if (list.profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const id = `${alias}-${Math.random().toString(36).substring(2, 9)}`
      const tar = await tarSnapshotFromUrl(location)
      const pStore = profileStore(tar)
      await pStore.init({ id, ...profile })
      list.profiles[alias] = {
        id,
        location,
      }
      list.current = alias
      await init(pStore)
      await localStore.write(profileListFileName, JSON.stringify(list))
      return {
        info: {
          id,
          ...profile,
        },
        store: tar,
      }
    },
  }
}

export type LocalProfilesConfig = ReturnType<typeof localProfilesConfig>
