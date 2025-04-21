import { Command, Flags, Interfaces, settings as oclifSettings } from '@oclif/core'
import {
  LogLevel, Logger, logLevels, ComposeModel, ProcessError, telemetryEmitter,
} from '@preevy/core'
import { asyncReduce } from 'iter-tools-es'
import { ArgOutput, FlagOutput, Input, ParserOutput, ParsingToken } from '@oclif/core/lib/interfaces/parser.js'
import { mergeWith } from 'lodash-es'
import { commandLogger } from '../lib/log.js'
import { composeFlags, pluginFlags } from '../lib/common-flags/index.js'
import { PreevyConfig } from '../../../core/src/config.js'
import { errorToJson } from '../lib/errors.js'


export type Flags<T extends typeof Command> = Interfaces.InferredFlags<typeof BaseCommand['baseFlags'] & T['flags']>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

const argsFromRaw = (raw: ParsingToken[]) => raw.filter(arg => arg.type === 'arg').map(arg => arg.input).filter(Boolean)

const jsonFlags = {
  json: Flags.boolean({
    description: 'Format output as JSON',
    helpGroup: 'GLOBAL',
  }),
} as const

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
    ...pluginFlags,
  }

  protected flags!: Flags<T>
  protected args!: Args<T>
  #rawArgs!: ParsingToken[]

  #userModel?: ComposeModel
  protected async userModel() {
    const { initialUserModel } = this.config
    if (initialUserModel instanceof Error) {
      return initialUserModel
    }

    if (!this.#userModel) {
      this.#userModel = await this.modelFilter(initialUserModel)
    }
    return this.#userModel
  }

  protected get modelFilter() {
    return (model: ComposeModel) => asyncReduce(
      model,
      (filteredModel, hook) => hook({ log: this.logger, userModel: filteredModel }, undefined),
      this.config.preevyHooks?.userModelFilter || [],
    )
  }

  protected get preevyConfig(): PreevyConfig {
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

  protected async reparse<
    F extends FlagOutput,
    B extends FlagOutput,
    A extends ArgOutput>(
    options?: Input<F, B, A>,
    argv?: string[],
  ): Promise<ParserOutput<F, B, A>> {
    return await this.parse(mergeWith({
      flags: this.ctor.flags,
      baseFlags: {
        ...this.ctor.baseFlags,
        ...this.ctor.enableJsonFlag ? jsonFlags : {},
      },
      args: this.ctor.args,
      strict: false,
    }, options, argv))
  }

  public async init(): Promise<void> {
    await super.init()
    const { args, flags, raw } = await this.reparse()
    this.args = args as Args<T>
    this.flags = flags as Flags<T>
    if (this.flags.debug) {
      oclifSettings.debug = true
    }
    this.#rawArgs = raw
    this.stdErrLogger = commandLogger(this, 'stderr')
    this.logger = this.jsonEnabled() ? this.stdErrLogger : commandLogger(this, 'stdout')
  }

  protected logger!: Logger
  protected stdErrLogger!: Logger

  protected get rawArgs() { return argsFromRaw(this.#rawArgs) }

  public get logLevel(): LogLevel {
    return this.flags['log-level'] ?? this.flags.debug ? 'debug' : 'info'
  }

  public log(message?: string, ...args: unknown[]): void {
    this.logger.info(message, ...args)
  }

  public logToStderr(message?: string | undefined, ...args: unknown[]): void {
    this.stdErrLogger.info(message, ...args)
  }

  async catch(error: Error) {
    const emitter = telemetryEmitter()
    emitter.capture('error', {
      error: errorToJson(error),
    })
    emitter.unref()
    await emitter.flush()

    return await super.catch(error)
  }


  protected toErrorJson(err: unknown) {
    return { error: errorToJson(err) }
  }
}

export default BaseCommand
