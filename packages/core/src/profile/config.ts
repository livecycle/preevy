import path from 'path'
import { rimraf } from 'rimraf'
import { isEmpty } from 'lodash'
import { localFs } from '../store/fs/local'
import { Store, VirtualFS, store, tarSnapshot } from '../store'
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
  const localProfilesDir = path.join(localDir, 'profiles')
  const storeFromUrl = async (
    url: string,
  ) => store(async dir => await tarSnapshot(await fsFromUrl(url, localProfilesDir), dir))

  async function readProfileList(): Promise<ProfileList> {
    const data = await localStore.read(profileListFileName)
    if (!data) {
      const initData = { current: undefined, profiles: {} }
      await localStore.write(profileListFileName, JSON.stringify(initData))
      return initData
    }
    return JSON.parse(data.toString())
  }

  type GetResult = {
    location: string
    info: Profile
    store: Store
  }

  async function get(alias: string): Promise<GetResult>
  async function get(alias: string, opts: { throwOnNotFound: false }): Promise<GetResult>
  async function get(alias: string, opts: { throwOnNotFound: true }): Promise<GetResult | undefined>
  async function get(alias: string, opts?: { throwOnNotFound: boolean }): Promise<GetResult | undefined> {
    const { profiles } = await readProfileList()
    const locationUrl = profiles[alias]?.location
    if (!locationUrl) {
      if (opts?.throwOnNotFound) {
        throw new Error(`Profile ${alias} not found`)
      }
      return undefined
    }
    const tarSnapshotStore = await storeFromUrl(locationUrl)
    const profileInfo = await profileStore(tarSnapshotStore).info()
    return {
      location: locationUrl,
      info: profileInfo,
      store: tarSnapshotStore,
    }
  }

  const create = async (alias: string, location: string, profile: Omit<Profile, 'id'>, init: (store: ProfileStore) => Promise<void>) => {
    const list = await readProfileList()
    if (list.profiles[alias]) {
      throw new Error(`Profile ${alias} already exists`)
    }
    const id = `${alias}-${Math.random().toString(36).substring(2, 9)}`
    const tar = await storeFromUrl(location)
    const pStore = profileStore(tar)
    await pStore.init({ id, ...profile })
    list.profiles[alias] = {
      id,
      location,
    }
    await init(pStore)
    await localStore.write(profileListFileName, JSON.stringify(list))
    return {
      info: {
        id,
        ...profile,
      },
      store: tar,
    }
  }

  const copy = async (source: { location: string }, target: { alias: string; location: string }, drivers: string[]) => {
    const sourceStore = await storeFromUrl(source.location)
    const sourceProfileStore = profileStore(sourceStore)
    const { driver } = await sourceProfileStore.info()
    await create(target.alias, target.location, { driver }, async pStore => {
      await pStore.setTunnelingKey(await sourceProfileStore.getTunnelingKey())
      if (driver) {
        await pStore.updateDriver(driver)
      }
      await Promise.all(drivers.map(async sourceDriver => {
        const driverFlags = await sourceProfileStore.defaultFlags(sourceDriver)
        if (!isEmpty(driverFlags)) {
          await pStore.setDefaultFlags(sourceDriver, driverFlags)
        }
      }))
    })
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
    get,
    async delete(alias: string) {
      const list = await readProfileList()
      const listing = list.profiles[alias]
      if (!listing) {
        throw new Error(`Profile ${alias} does not exist`)
      }
      delete list.profiles[alias]
      if (list.current === alias) {
        list.current = undefined
      }
      await localStore.write(profileListFileName, JSON.stringify(list))
      if (listing.location.startsWith('local://')) {
        await rimraf(path.join(localProfilesDir, alias))
      }
    },
    async importExisting(alias: string, location: string) {
      const list = await readProfileList()
      if (list.profiles[alias]) {
        throw new Error(`Profile ${alias} already exists`)
      }
      const tarSnapshotStore = await storeFromUrl(location)
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
    create,
    copy,
  }
}

export type LocalProfilesConfig = ReturnType<typeof localProfilesConfig>
