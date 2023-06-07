import { Command, Flags, Interfaces, settings as oclifSettings } from '@oclif/core'
import {
  LogLevel, Logger, logLevels, ComposeModel, ProcessError, telemetryEmitter,
} from '@preevy/core'
import { asyncReduce } from 'iter-tools-es'
import { commandLogger } from '../lib/log'
import { composeFlags } from '../lib/flags'

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
    ...composeFlags,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  #userModel?: ComposeModel
  protected async userModel() {
    const { initialUserModel, preevyHooks } = this.config
    if (initialUserModel instanceof Error) {
      return initialUserModel
    }

    if (!this.#userModel) {
      this.#userModel = await asyncReduce(
        initialUserModel,
        (userModel, hook) => hook({ log: this.logger, userModel }, undefined),
        preevyHooks?.userModelFilter || [],
      )
    }
    return this.#userModel
  }

  protected get preevyConfig() {
    return this.config.preevyConfig
  }

  protected async ensureUserModel() {
    const result = await this.userModel()
    if (result instanceof Error) {
      this.error(result, {
        exit: result.cause instanceof ProcessError ? result.cause.process.exitCode ?? 1 : 1,
        code: 'ERR_LOADING_COMPOSE_FILE',
        message: result.message,
        ref: 'https://docs.docker.com/compose/compose-file/03-compose-file/',
        suggestions: [
          'Run the command at a directory containing a compose file',
          'Specify the -f flag',
        ],
      })
    }
    return result
  }

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

  // eslint-disable-next-line class-methods-use-this
  async catch(error: Error) {
    const emitter = telemetryEmitter()
    emitter.capture('error', {
      error,
    })
    emitter.unref()
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await emitter.flush()
    return super.catch(error)
  }
}

export default BaseCommand
