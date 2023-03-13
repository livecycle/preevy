import { realFs } from '../store/fs'
import { Store } from '../store'
import { ProfileStore, profileStore } from './store'
import { Profile } from './types'

type ProfileListing = {
  alias:string
  id: string
  location: string
}

type ProfileList = {
  current: string | undefined
  profiles: Record<string, Omit<ProfileListing, 'alias'>>
}

const profileListFileName = 'profileList.json'

export const profileConfig = (localDir:string, profileStoreResolver: (location: string)=> Promise<Store>) => {
  const localStore = realFs(localDir)

  async function getProfileList(): Promise<ProfileList> {
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
      const profileData = await getProfileList()
      if (!profileData.current) {
        return undefined
      }
      return {
        alias: profileData.current,
        id: profileData.current,
        location: profileData.profiles[profileData.current].location,
      }
    },
    async setCurrent(alias: string) {
      const data = await getProfileList()
      data.current = alias
      await localStore.write(profileListFileName, JSON.stringify(data))
    },
    async list(): Promise<ProfileListing[]> {
      return Object.entries((await getProfileList()).profiles).map(([alias, profile]) => ({ alias, ...profile }))
    },
    async get(alias: string) {
      const data = await getProfileList()
      const location = data.profiles[alias]?.location
      if (!location) {
        throw new Error(`Profile ${alias} not found`)
      }
      let store: Store
      try {
        store = await profileStoreResolver(location)
      } catch (error) {
        throw new Error(`Failed to resolve store for profile ${alias}, error: ${error}}`)
      }
      const profileInfo = await profileStore(store).info()
      return {
        info: profileInfo,
        store,
      }
    },
    async delete(alias: string) {
      const data = await getProfileList()
      if (data.profiles[alias]) {
        throw new Error(`Profile ${alias} doesn't exists`)
      }
      delete data.profiles[alias]
      await localStore.write(profileListFileName, JSON.stringify(data))
    },
    async importExisting(alias: string, location: string) {
      const data = await getProfileList()
      if (data.profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const remoteStore = await profileStoreResolver(location)
      const info = await profileStore(remoteStore).info()
      data.profiles[alias] = {
        id: info.id,
        location,
      }
      data.current = alias
      await localStore.write(profileListFileName, JSON.stringify(data))
      return {
        info,
        store: remoteStore,
      }
    },
    async create(alias: string, location: string, profile: Omit<Profile, 'id'>, init: (store: ProfileStore) => Promise<void>) {
      const data = await getProfileList()
      if (data.profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const id = `${alias}-${Math.random().toString(36).substring(2, 9)}`
      const remoteStore = await profileStoreResolver(location)
      const pStore = profileStore(remoteStore)
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
        store: remoteStore,
      }
    },
  }
}

export type ProfileConfig = ReturnType<typeof profileConfig>
