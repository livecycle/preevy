import { Command, Flags, Interfaces } from '@oclif/core'
import BaseCommand from './base-command'
import { flagsForAllDrivers, DriverName, MachineDriver, machineDrivers, DriverFlags } from './lib/machine'
import { removeDriverPrefix } from './lib/machine/driver/flags'
import { profileStore } from './lib/profile/store'
import ProfileCommand from './profile-command'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof DriverCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

abstract class DriverCommand<T extends typeof Command> extends ProfileCommand<T> {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    driver: Flags.custom<DriverName>({
      description: 'Machine driver to use',
      char: 'd',
      options: Object.keys(machineDrivers),
      required: false,
    })(),
    ...flagsForAllDrivers,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    this.#driverName = this.flags.driver ?? this.profile.driver as DriverName
  }

  #driverName: DriverName | undefined
  get driverName() : DriverName {
    if (!this.#driverName) {
      throw new Error("Driver wasn't specified")
    }
    return this.#driverName
  }

  #driver: MachineDriver | undefined
  async driver() {
    if (this.#driver) {
      return this.#driver
    }
    const { profile, driverName } = this
    const driverFlags = {
      ...await profileStore(this.store).defaultFlags(driverName),
      ...removeDriverPrefix<DriverFlags<DriverName, 'flags'>>(driverName, this.flags),
    }
    this.#driver = machineDrivers[driverName].factory(driverFlags as never, profile)
    return this.#driver
  }
}

export default DriverCommand
