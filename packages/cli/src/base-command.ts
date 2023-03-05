import { Command, Flags, Interfaces } from '@oclif/core'
import { FlagInput } from '@oclif/core/lib/interfaces/parser'
import { commandLogger, Logger, LogLevel, logLevels } from './log'

export type InferredFlags<T> = T extends FlagInput<infer F> ? F & {
  json: boolean | undefined
} : never;

// export type InferredFlags<T extends FlagOutput> = T & {
//   json: boolean | undefined;
// }

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

abstract class BaseCommand<T extends typeof Command> extends Command {
  static baseFlags = {
    'log-level': Flags.custom<LogLevel>({
      summary: 'Specify level for logging.',
      options: Object.keys(logLevels),
      helpGroup: 'GLOBAL',
      default: 'info',
    })(),
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: super.ctor.baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict,
    })
    this.args = args as Args<T>
    this.flags = flags as Flags<T>
    this.logger = commandLogger(this, 'stdout')
    this.stdErrLogger = commandLogger(this, 'stderr')
  }

  protected logger!: Logger
  protected stdErrLogger!: Logger

  public get logLevel(): LogLevel {
    return this.flags['log-level'] as LogLevel
  }

  public log(message?: string, ...args: unknown[]): void {
    this.logger.info(message, ...args)
  }

  public logToStderr(message?: string | undefined, ...args: unknown[]): void {
    this.stdErrLogger.info(message, ...args)
  }
}

export default BaseCommand
