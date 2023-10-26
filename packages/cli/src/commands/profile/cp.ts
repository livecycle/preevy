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

const chooseTargetAlias = async (defaultAlias: string) => (
  await inquirer.prompt<{ targetAlias: string }>([
    {
      type: 'input',
      name: 'targetAlias',
      message: 'Target profile name',
      default: defaultAlias,
    },
  ])
).targetAlias

// eslint-disable-next-line no-use-before-define
export default class CopyProfile extends BaseCommand<typeof CopyProfile> {
  static description = 'Copy a profile'

  static enableJsonFlag = true

  static flags = {
    profile: Flags.string({
      description: 'Source profile name, defaults to the current profile',
      required: false,
    }),
    // eslint-disable-next-line no-restricted-globals
    'target-location': Flags.custom<{ location: string; fsType: FsType }>({
      description: 'Target profile location URL',
      required: false,
      exclusive: ['target-storage'],
      parse: async location => {
        let url: URL
        try {
          url = new URL(location)
        } catch (e) {
          throw new Error(`Invalid URL: ${text.code(location)}`, { cause: e })
        }
        return { location, fsType: validateFsType(url.protocol.replace(':', '')) }
      },
    })(),
    'target-storage': Flags.custom<FsType>({
      description: 'Target profile storage type',
      required: false,
      options: [...fsTypes],
    })(),
    'target-name': Flags.string({
      description: 'Target profile name',
      required: false,
    }),
    use: Flags.boolean({
      description: 'Mark the new profile as the current profile',
      required: false,
    }),
  }

  async source(profileConfig: LocalProfilesConfig): Promise<{ alias: string; location: string }> {
    if (this.flags.profile) {
      const { location } = await profileConfig.get(this.flags.profile)
      return { alias: this.flags.profile, location }
    }
    const result = await profileConfig.current()
    if (!result) {
      throw new Error(`No current profile, specify the source alias with ${text.code(`--${CopyProfile.flags.profile.name}`)}`)
    }
    ux.info(`Copying current profile ${text.code(result.alias)} from ${text.code(result.location)}`)
    return result
  }

  async target(source: { alias: string }): Promise<{ location: string; alias: string }> {
    const { 'target-location': targetLocation, 'target-storage': targetStorage } = this.flags
    const fsType = targetLocation?.fsType ?? targetStorage ?? await chooseFsType()
    const alias = this.flags['target-name'] ?? await chooseTargetAlias(`${source.alias}-${fsType}`)
    return { alias, location: targetLocation?.location ?? await chooseFs[fsType]({ profileAlias: alias }) }
  }

  async run(): Promise<unknown> {
    const profileConfig = loadProfileConfig(this.config)
    const source = await this.source(profileConfig)
    const target = await this.target(source)
    await profileConfig.copy(source, target, Object.keys(machineDrivers))

    ux.info(text.success(`Profile ${text.code(source.alias)} copied to ${text.code(target.location)} as ${text.code(target.alias)}`))

    if (this.flags.use) {
      await profileConfig.setCurrent(target.alias)
    }

    return { source, target }
  }
}
