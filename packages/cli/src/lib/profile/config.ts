import path from 'path'
import { localFs } from '../store/fs/local'
import { fsFromUrl, snapshotStore, tarSnapshot } from '../store'
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

export const localProfilesConfig = (localDir: string) => {
  const localStore = localFs(localDir)
  const tarSnapshotStoreFromUrl = async (
    url: string,
  ) => snapshotStore(await fsFromUrl(url, path.join(localDir, 'profiles')), tarSnapshot)

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
      const profileData = await readProfileList()
      if (!profileData.current || !profileData.profiles[profileData.current]) {
        return undefined
      }
      return {
        alias: profileData.current,
        id: profileData.profiles[profileData.current].id,
        location: profileData.profiles[profileData.current].location,
      }
    },
    async setCurrent(alias: string) {
      const data = await readProfileList()
      if (!data.profiles[alias]) {
        throw new Error(`Profile ${alias} doesn't exists`)
      }
      data.current = alias
      await localStore.write(profileListFileName, JSON.stringify(data))
    },
    async list(): Promise<ProfileListing[]> {
      return Object.entries((await readProfileList()).profiles).map(([alias, profile]) => ({ alias, ...profile }))
    },
    async get(alias: string) {
      const data = await readProfileList()
      const locationUrl = data.profiles[alias]?.location
      if (!locationUrl) {
        throw new Error(`Profile ${alias} not found`)
      }
      const tarSnapshotStore = await tarSnapshotStoreFromUrl(locationUrl)
      const profileInfo = await profileStore(tarSnapshotStore).info()
      return {
        info: profileInfo,
        store: tarSnapshotStore,
      }
    },
    async delete(alias: string) {
      const data = await readProfileList()
      if (!data.profiles[alias]) {
        throw new Error(`Profile ${alias} doesn't exists`)
      }
      delete data.profiles[alias]
      await localStore.write(profileListFileName, JSON.stringify(data))
    },
    async importExisting(alias: string, location: string) {
      const data = await readProfileList()
      if (data.profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const tarSnapshotStore = await tarSnapshotStoreFromUrl(location)
      const info = await profileStore(tarSnapshotStore).info()
      data.profiles[alias] = {
        id: info.id,
        location,
      }
      data.current = alias
      await localStore.write(profileListFileName, JSON.stringify(data))
      return {
        info,
        store: tarSnapshotStore,
      }
    },
    async create(alias: string, location: string, profile: Omit<Profile, 'id'>, init: (store: ProfileStore) => Promise<void>) {
      const data = await readProfileList()
      if (data.profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const id = `${alias}-${Math.random().toString(36).substring(2, 9)}`
      const tarSnapshotStore = await tarSnapshotStoreFromUrl(location)
      const pStore = profileStore(tarSnapshotStore)
      await pStore.init({ id, ...profile })
      data.profiles[alias] = {
        id,
        location,
      }
      data.current = alias
      await init(pStore)
      await localStore.write(profileListFileName, JSON.stringify(data))
      return {
        info: {
          id,
          ...profile,
        },
        store: tarSnapshotStore,
      }
    },
  }
}

export type LocalProfilesConfig = ReturnType<typeof localProfilesConfig>
