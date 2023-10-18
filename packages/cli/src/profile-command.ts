import path from 'path'
import { Command, Flags, Interfaces } from '@oclif/core'
import { LocalProfilesConfig, Profile, Store, detectCiProvider, fsTypeFromUrl, localProfilesConfig, telemetryEmitter } from '@preevy/core'
import { BaseCommand, text } from '@preevy/cli-common'
import { fsFromUrl } from './fs'

export const onProfileChange = (profile: Profile, alias: string, location: string) => {
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
      profile_store_type: fsTypeFromUrl(location),
    }
  )
}

export const loadProfileConfig = ({ dataDir }: { dataDir: string }): LocalProfilesConfig => {
  const profileRoot = path.join(dataDir, 'v2')
  return localProfilesConfig(profileRoot, fsFromUrl)
}

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof ProfileCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

abstract class ProfileCommand<T extends typeof Command> extends BaseCommand<T> {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    profile: Flags.string({
      description: 'Run in a specific profile context',
      required: false,
    }),
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    const { profileConfig } = this
    let profileAlias = this.flags.profile
    if (!profileAlias) {
      const currentProfile = await profileConfig.current()
      if (currentProfile) {
        profileAlias = currentProfile.alias
      }
    }
    if (!profileAlias) {
      return
    }
    const currentProfileInfo = await profileConfig.get(profileAlias)
    if (!currentProfileInfo) {
      return
    }

    this.#profile = currentProfileInfo.info
    this.#store = currentProfileInfo.store
    onProfileChange(currentProfileInfo.info, profileAlias, currentProfileInfo.location)
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
