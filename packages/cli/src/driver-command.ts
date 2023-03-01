import BaseCommand, { InferredFlags } from './base-command'
import { Command, Flags, Interfaces } from "@oclif/core"
import { allDriverFlags, DriverName, driverRelationships, MachineDriver, machineDrivers } from './lib/machine'
import { FlagInput, FlagOutput } from '@oclif/core/lib/interfaces/parser'

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
      relationships: driverRelationships('driver'),
    })(),
    ...allDriverFlags,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    const driverName = this.flags.driver as DriverName
    this.machineDriver = machineDrivers[driverName].fromFlags(driverName, this.flags)
  }

  protected machineDriver!: MachineDriver
}

export default DriverCommand
