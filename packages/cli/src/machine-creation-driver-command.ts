import { Command, Flags, Interfaces } from '@oclif/core'
import { MachineCreationDriver } from '@preevy/core'
import { BaseCommand } from '@preevy/cli-common'
import DriverCommand from './driver-command.js'
import { machineCreationflagsForAllDrivers, machineDrivers } from './drivers.js'


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
    this.#machineCreationDriver = machineDrivers[driverName].machineCreationFactory({
      flags: await this.driverFlags(driverName, 'machineCreationFlags') as never,
      profile,
      store: this.store,
      log: this.logger,
      debug: this.flags.debug,
    })
    return this.#machineCreationDriver
  }
}

export default MachineCreationDriverCommand
