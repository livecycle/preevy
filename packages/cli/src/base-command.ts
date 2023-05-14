import { Command, Flags, Interfaces, settings as oclifSettings } from '@oclif/core'
import path from 'path'
import { LogLevel, Logger, logLevels, LocalProfilesConfig, localProfilesConfig } from '@preevy/core'
import { commandLogger } from './log'

// eslint-disable-next-line no-use-before-define
export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

abstract class BaseCommand<T extends typeof Command=typeof Command> extends Command {
  static baseFlags = {
    'log-level': Flags.custom<LogLevel>({
      summary: 'Specify level for logging',
      hidden: true,
      options: Object.keys(logLevels),
      helpGroup: 'GLOBAL',
      required: false,
    })(),
    debug: Flags.boolean({
      char: 'D',
      summary: 'Enable debug logging',
      env: 'DEBUG',
      default: false,
      helpGroup: 'GLOBAL',
      relationships: [
        { type: 'none', flags: ['log-level'] },
      ],
    }),
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
    if (this.flags.debug) {
      oclifSettings.debug = true
    }
    this.logger = commandLogger(this, 'stdout')
    this.stdErrLogger = commandLogger(this, 'stderr')
  }

  protected logger!: Logger
  protected stdErrLogger!: Logger

  public get logLevel(): LogLevel {
    return this.flags['log-level'] ?? this.flags.debug ? 'debug' : 'info'
  }

  public log(message?: string, ...args: unknown[]): void {
    this.logger.info(message, ...args)
  }

  public logToStderr(message?: string | undefined, ...args: unknown[]): void {
    this.stdErrLogger.info(message, ...args)
  }

  #profileConfig: LocalProfilesConfig | undefined
  get profileConfig(): LocalProfilesConfig {
    if (!this.#profileConfig) {
      const root = path.join(this.config.dataDir, 'v2')
      this.logger.debug('init profile config at:', root)
      this.#profileConfig = localProfilesConfig(root)
    }

    return this.#profileConfig
  }
}

export default BaseCommand
