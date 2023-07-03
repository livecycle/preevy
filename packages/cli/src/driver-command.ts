import { Command, Flags, Interfaces } from '@oclif/core'
import { MachineDriver, profileStore } from '@preevy/core'
import { BaseCommand } from '@preevy/cli-common'
import { pickBy } from 'lodash'
import ProfileCommand from './profile-command'
import { DriverFlags, DriverName, flagsForAllDrivers, machineDrivers, removeDriverPrefix } from './drivers'

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
  async driver(): Promise<MachineDriver> {
    if (this.#driver) {
      return this.#driver
    }
    const { profile, driverName } = this
    const driverFlagNames = Object.keys(machineDrivers[driverName].flags)
    const defaultFlags = pickBy(
      await profileStore(this.store).defaultFlags(driverName),
      (_v, k) => driverFlagNames.includes(k),
    )
    const driverFlags = {
      ...defaultFlags,
      ...removeDriverPrefix<DriverFlags<DriverName, 'flags'>>(driverName, this.flags),
    }
    this.#driver = machineDrivers[driverName].factory({
      flags: driverFlags as never,
      profile,
      store: this.store,
      log: this.logger,
      debug: this.flags.debug,
    })
    return this.#driver as MachineDriver
  }
}

export default DriverCommand
