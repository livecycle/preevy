import { Flags, ux } from '@oclif/core'
import inquirer from 'inquirer'
import { BaseCommand, text } from '@preevy/cli-common'
import { LocalProfilesConfig } from '@preevy/core'
import { loadProfileConfig } from '../../profile-command'
import { FsType, chooseFs, chooseFsType, fsTypes, isFsType } from '../../fs'
import { machineDrivers } from '../../drivers'

const validateFsType = (fsType: string) => {
  if (!isFsType(fsType)) {
    throw new Error(`Unsupported storage type: ${text.code(fsType)}. Supported types: ${text.codeList(fsTypes as readonly string[])}`)
  }
  return fsType
}

const parseFsTypeFromUrl = (target: string) => {
  const [fsType, ...rest] = target.split('://')
  return rest.length ? validateFsType(fsType) : undefined
}

// eslint-disable-next-line no-use-before-define
export default class CopyProfile extends BaseCommand<typeof CopyProfile> {
  static description = 'Copy a profile'

  static enableJsonFlag = true

  static flags = {
    profile: Flags.string({
      description: 'Source profile name, defaults to the current profile',
      required: false,
    }),
    target: Flags.custom<{ url?: string; fsType: FsType }>({
      description: `Target profile. Either a full URL or a storage type, one of: ${fsTypes.join(', ')}`,
      required: false,
      parse: async input => {
        if (isFsType(input)) {
          return { fsType: input }
        }
        const fsType = parseFsTypeFromUrl(input)
        if (!fsType) {
          throw new Error(`Invalid target profile. Specify either a full URL or a storage type, one of: ${text.codeList(fsTypes)}`)
        }
        return { fsType, url: input }
      },
    })(),
    'target-name': Flags.string({
      description: 'Target profile name. If not specified, the command will ask for one',
      required: false,
    }),
    use: Flags.boolean({
      description: 'Mark the new profile as the current profile',
      required: false,
    }),
  }

  async source(profileConfig: LocalProfilesConfig): Promise<{
    alias: string
    location: string
  }> {
    if (this.flags.profile) {
      const { location } = await profileConfig.get(this.flags.profile)
      return { alias: this.flags.profile, location }
    }
    const result = await profileConfig.current()
    if (!result) {
      throw new Error(`No current profile, specify the source alias with ${text.code('--profile')}`)
    }
    ux.info(`Copying current profile ${text.code(result.alias)} from ${text.code(result.location)}`)
    return result
  }

  async targetAlias(source: { alias: string }, fsType: string): Promise<string> {
    if (this.flags['target-name']) {
      return this.flags['target-name']
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

  async target(source: { alias: string }): Promise<{ url: string; alias: string }> {
    if (this.flags.target) {
      const { url, fsType } = this.flags.target
      const alias = await this.targetAlias(source, fsType)
      return { alias, url: url || await chooseFs[fsType]({ profileAlias: alias }) }
    }

    const fsType = await chooseFsType()
    const alias = await this.targetAlias(source, fsType)
    return { alias, url: await chooseFs[fsType]({ profileAlias: alias }) }
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
