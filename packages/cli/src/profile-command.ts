import { Command, Flags, Interfaces } from '@oclif/core'
import chalk from 'chalk'
import BaseCommand from './base-command'
import { Profile } from './lib/profile'
import { Store } from './lib/store'
import { telemetryEmitter } from './lib/telemetry'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof ProfileCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

export const onProfileChange = (profile: Profile) => {
  telemetryEmitter().identify(profile.id, { profile_driver: profile.driver })
}

abstract class ProfileCommand<T extends typeof Command> extends BaseCommand<T> {
  static baseFlags = {
    ...BaseCommand.baseFlags,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    const pm = this.profileConfig
    const currentProfile = await pm.current().then(x => x && pm.get(x.alias))
    if (currentProfile) {
      this.#profile = currentProfile.info
      this.#store = currentProfile.store
      onProfileChange(currentProfile.info)
    }
  }

  #store: Store | undefined
  get store(): Store {
    if (!this.#store) {
      throw new Error("Store wasn't initialized")
    }
    return this.#store
  }

  #profile: Profile | undefined
  get profile(): Profile {
    if (!this.#profile) {
      throw new Error(`Profile not initialized, run ${chalk.italic.bold.greenBright('preevy init')} to get started.`)
    }
    return this.#profile
  }
}

export default ProfileCommand
