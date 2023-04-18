import { Command, Flags, Interfaces } from '@oclif/core'
import BaseCommand from './base-command'
import { DriverFlags, DriverName, machineCreationflagsForAllDrivers, machineDrivers } from './lib/machine'
import DriverCommand from './driver-command'
import { MachineCreationDriver } from './lib/machine/driver/driver'
import { removeDriverPrefix } from './lib/machine/driver/flags'
import { profileStore } from './lib/profile'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof MachineCreationDriverCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

abstract class MachineCreationDriverCommand<T extends typeof Command> extends DriverCommand<T> {
  static baseFlags = {
    ...BaseCommand.baseFlags,
    ...DriverCommand.baseFlags,
    ...machineCreationflagsForAllDrivers,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  #machineCreationDriver: MachineCreationDriver | undefined
  async machineCreationDriver() {
    if (this.#machineCreationDriver) {
      return this.#machineCreationDriver
    }
    const { profile, driverName } = this
    const defaultFlags = await profileStore(this.store).defaultFlags(driverName)
    const specifiedFlags = removeDriverPrefix<DriverFlags<DriverName, 'machineCreationFlags'>>(this.driverName, this.flags)
    const driverFlags = { ...defaultFlags, ...specifiedFlags }
    this.#machineCreationDriver = machineDrivers[driverName].machineCreationFactory(
      driverFlags as never,
      profile,
    )
    return this.#machineCreationDriver
  }
}

export default MachineCreationDriverCommand
