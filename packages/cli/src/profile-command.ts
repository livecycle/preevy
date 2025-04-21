import path from 'path'
import { Command, Flags, Interfaces } from '@oclif/core'
import {
  tryParseUrl, LocalProfilesConfig, Profile, Store, detectCiProvider, fsTypeFromUrl,
  localProfilesConfig, telemetryEmitter, LocalProfilesConfigGetResult, ProfileLoadError,
} from '@preevy/core'
import { BaseCommand, text } from '@preevy/cli-common'
import { fsFromUrl } from './fs.js'

export const onProfileChange = (profile: Profile, profileStoreType: string) => {
  const ciProvider = detectCiProvider()
  if (ciProvider) {
    telemetryEmitter().identify(`ci_${ciProvider.id ?? 'unknown'}_${profile.id}`, {
      ci_provider: ciProvider.name,
    })
  }
  telemetryEmitter().group(
    { type: 'profile', id: profile.id },
    {
      profile_driver: profile.driver,
      profile_id: profile.id,
      name: profile.id,
      profile_store_type: profileStoreType,
    }
  )
}

export const loadProfileConfig = ({ dataDir }: { dataDir: string }): LocalProfilesConfig => {
  const profileRoot = path.join(dataDir, 'v2')
  return localProfilesConfig(profileRoot, fsFromUrl)
}


export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof ProfileCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

const findAvailableProfileAlias = (
  { existing, prefix }: { existing: Set<string>; prefix: string },
  index = 0,
): string => {
  const candidate = [prefix, index].filter(Boolean).join('-')
  return existing.has(candidate) ? findAvailableProfileAlias({ existing, prefix }, index + 1) : candidate
}

const findProfile = async (
  { profileConfig, flags: { profile: profileFlag } }: {
    profileConfig: LocalProfilesConfig
    flags: { profile?: string }
  },
): Promise<LocalProfilesConfigGetResult | undefined> => {
  const profileUrl = tryParseUrl(profileFlag || '')
  if (!profileUrl) {
    // eslint false positive here on case-sensitive filesystems due to unknown type

    return await profileConfig.get(profileFlag)
  }

  const { profiles } = await profileConfig.list()

  const found = Object.values(profiles).find(p => p.location === profileFlag)
  if (found) {
    // eslint false positive here on case-sensitive filesystems due to unknown type

    return await profileConfig.get(found.alias)
  }

  const newAlias = findAvailableProfileAlias({
    existing: new Set(Object.keys(profiles)),
    prefix: profileUrl.hostname,
  })

  // eslint false positive here on case-sensitive filesystems due to unknown type

  return await profileConfig.importExisting(newAlias, profileUrl.toString())
}

abstract class ProfileCommand<T extends typeof Command> extends BaseCommand<T> {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    profile: Flags.string({
      description: 'Run in a specific profile context (either an alias or a URL)',
      required: false,
    }),
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  protected throwOnProfileNotFound = true

  public async init(): Promise<void> {
    await super.init()
    const { profileConfig, flags } = this
    const profile = await findProfile({ profileConfig, flags }).catch(e => {
      if (!(e instanceof ProfileLoadError) || this.throwOnProfileNotFound) {
        throw e
      }
      this.logger.warn(`Profile load error: ${e.message}`)
      return undefined
    })
    if (!profile) {
      return
    }
    this.#profile = profile.info
    this.#store = profile.store
    onProfileChange(profile.info, fsTypeFromUrl(profile.location))
  }

  #profileConfig: LocalProfilesConfig | undefined
  get profileConfig(): LocalProfilesConfig {
    if (!this.#profileConfig) {
      this.#profileConfig = loadProfileConfig(this.config)
    }

    return this.#profileConfig
  }

  #store: Store | undefined
  get store(): Store {
    if (!this.#store) {
      this.error('Store was not initialized')
    }
    return this.#store
  }

  #profile: Profile | undefined
  get profile(): Profile {
    if (!this.#profile) {
      this.error(`Profile not initialized, run ${text.command(this.config, 'init')} to get started.`)
    }
    return this.#profile
  }
}

export default ProfileCommand
