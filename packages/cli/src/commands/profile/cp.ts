import { FlagOutput, ArgOutput, ParserOutput } from '@oclif/core/lib/interfaces/parser'
import { Args, Flags, ux } from '@oclif/core'
import inquirer from 'inquirer'
import { BaseCommand, text } from '@preevy/cli-common'
import { LocalProfilesConfig } from '@preevy/core'
import { mapValues } from 'lodash'
import { loadProfileConfig } from '../../profile-command'
import { chooseFs, chooseFsType } from '../../fs'
import { machineDrivers } from '../../drivers'

const parseFsType = (target: string) => {
  const [fsType, ...rest] = target.split('://')
  return rest.length ? fsType : undefined
}

// eslint-disable-next-line no-use-before-define
export default class CopyProfile extends BaseCommand<typeof CopyProfile> {
  static description = 'Copy a profile to another storage'

  static args = {
    source: Args.string({
      description: 'Source profile name, defaults to the current profile',
      required: false,
    }),
    target: Args.string({
      description: 'Target profile. Either a URL or a name, in which case the command will require interactive input to build the URL',
      required: true,
    }),
  }

  static enableJsonFlag = true

  static flags = {
    use: Flags.boolean({
      description: 'use the new profile',
      required: false,
    }),
    targetName: Flags.string({
      description: 'Target profile name',
      required: false,
    }),
  }

  // workaround for oclif bug when a required arg follows an optional arg
  protected async parse<
    F extends FlagOutput,
    B extends FlagOutput,
    A extends ArgOutput,
  >(): Promise<ParserOutput<F, B, A>> {
    const { args, ...result } = await super.parse({
      flags: CopyProfile.flags,
      baseFlags: CopyProfile.baseFlags,
      args: mapValues(CopyProfile.args, v => ({ ...v, required: false })) as typeof CopyProfile.args,
      strict: true,
    })
    if (!args.source) {
      throw new Error('You must specify a target')
    }
    const bothSpecified = args.target !== undefined
    return {
      ...result,
      args: {
        source: bothSpecified ? args.source : undefined,
        target: bothSpecified ? args.target : args.source,
      },
    } as unknown as ParserOutput<F, B, A>
  }

  public async init(): Promise<void> {
    await super.init()
    this.targetFsType = parseFsType(this.args.target)
  }

  async source(profileConfig: LocalProfilesConfig): Promise<{
    alias: string
    location: string
  }> {
    console.log('args', this.args)
    if (this.args.source) {
      const { location } = await profileConfig.get(this.args.source)
      return { alias: this.args.source, location }
    }
    const result = await profileConfig.current()
    if (!result) {
      throw new Error('No current profile, specify the source alias')
    }
    return result
  }

  async targetAlias(source: { alias: string }, fsType: string): Promise<string> {
    if (this.flags.targetName) {
      return this.flags.targetName
    }
    // eslint-disable-next-line no-use-before-define
    const { targetAlias } = await inquirer.prompt<{ targetAlias: string }>([
      {
        type: 'input',
        name: 'targetAlias',
        message: 'Target profile name',
        default: `${source.alias}-${fsType}`,
      },
    ])
    return targetAlias
  }

  targetFsType: string | undefined

  async target(source: { alias: string }): Promise<{ url: string; alias: string }> {
    if (this.targetFsType) {
      return { url: this.args.target, alias: await this.targetAlias(source, this.targetFsType) }
    }
    const fsType = await chooseFsType()
    const alias = await this.targetAlias(source, fsType)
    return { url: await chooseFs[fsType]({ profileAlias: alias }), alias }
  }

  async run(): Promise<unknown> {
    const profileConfig = loadProfileConfig(this.config)
    const source = await this.source(profileConfig)
    const target = await this.target(source)
    await profileConfig.copy(
      { location: source.location },
      { alias: target.alias, location: target.url },
      Object.keys(machineDrivers),
    )

    ux.info(text.success(`Profile ${text.code(source.alias)} copied to ${text.code(target.url)} as ${text.code(target.alias)}`))

    if (this.flags.use) {
      await profileConfig.setCurrent(target.alias)
    }

    return { source, target }
  }
}
