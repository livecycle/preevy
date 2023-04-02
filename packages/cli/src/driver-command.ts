import { Command, Flags, Interfaces } from '@oclif/core'
import chalk from 'chalk'
import BaseCommand from './base-command'
import { flagsForAllDrivers, DriverName, MachineDriver, machineDrivers, DriverFlags } from './lib/machine'
import { removeDriverPrefix } from './lib/machine/driver/flags'
import { Profile } from './lib/profile'
import { profileStore } from './lib/profile/store'
import { Store } from './lib/store'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof DriverCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

abstract class DriverCommand<T extends typeof Command> extends BaseCommand<T> {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    driver: Flags.custom<DriverName>({
      description: 'Machine driver to use',
      char: 'd',
      default: 'lightsail' as const,
      options: Object.keys(machineDrivers),
    })(),
    ...flagsForAllDrivers,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    this.#driverName = this.flags.driver as DriverName
    const pm = this.profileConfig
    const currentProfile = await pm.current().then(x => x && pm.get(x.alias))
    if (currentProfile) {
      this.#profile = currentProfile.info
      this.#store = currentProfile.store
      this.#driverName = currentProfile.info.driver as DriverName
    }
  }

  #driverName: DriverName | undefined
  get driverName() : DriverName {
    if (!this.#driverName) {
      throw new Error("Driver wasn't specified")
    }
    return this.#driverName
  }

  #store: Store | undefined
  get store(): Store {
    if (!this.#store) {
      throw new Error("Store wasn't initialized")
    }
    return this.#store
  }

  #driver: MachineDriver | undefined
  async driver() {
    if (this.#driver) {
      return this.#driver
    }
    const { profile } = this
    const driverName = this.flags.driver as DriverName
    let driverFlags = removeDriverPrefix<DriverFlags<DriverName, 'flags'>>(this.driverName, this.flags)
    if (this.#store) {
      const defaultFlags = await profileStore(this.#store).defaultFlags(driverName)
      driverFlags = { ...defaultFlags, ...driverFlags }
    }
    this.#driver = machineDrivers[driverName].factory(driverFlags as never, profile)
    return this.#driver
  }

  #profile: Profile | undefined
  get profile(): Profile {
    if (!this.#profile) {
      throw new Error(`Profile not initialized, run ${chalk.italic.bold.greenBright('preevy init')} to get started.`)
    }
    return this.#profile
  }
}

export default DriverCommand
