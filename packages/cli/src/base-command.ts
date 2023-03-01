import { Command, Flags, Interfaces, ux } from "@oclif/core"
import { FlagInput, FlagOutput } from "@oclif/core/lib/interfaces/parser";
import { ProgressReporter } from "./lib/progress"
import { commandLogger, Logger, LogLevel, logLevels, nullLogger } from "./log"

export type InferredFlags<T> = T extends FlagInput<infer F> ? F & {
  json: boolean | undefined;
} : never;

// export type InferredFlags<T extends FlagOutput> = T & {
//   json: boolean | undefined;
// }

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

  public log(message?: string, ...args: any[]): void {
    this.logger.info(message, ...args)
  }

  public logToStderr(message?: string | undefined, ...args: any[]): void {
    this.stdErrLogger.info(message, ...args)
  }

  public createProgressReporter(action: string): ProgressReporter {
    ux.action.start(action)
    let current = 0
    return {
      increment: (increment: number, status?: string) => {
        current += increment
        if (current >= 1) {
          ux.action.stop()
        } else {
          ux.action.status = `${Math.floor(current * 100)}% complete: ${status}`
        }
      },
    }
  }
}

export default BaseCommand