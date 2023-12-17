import { Flags, ux } from '@oclif/core'
import * as inquirer from '@inquirer/prompts'
import { BaseCommand, text } from '@preevy/cli-common'
import { LocalProfilesConfig } from '@preevy/core'
import { loadProfileConfig } from '../../profile-command.js'
import { FsType, chooseFs, chooseFsType, fsTypes, isFsType } from '../../fs.js'
import { machineDrivers } from '../../drivers.js'

const validateFsType = (fsType: string) => {
  if (!isFsType(fsType)) {
    throw new Error(`Unsupported storage type: ${text.code(fsType)}. Supported types: ${text.codeList(fsTypes as readonly string[])}`)
  }
  return fsType
}

const chooseTargetAlias = async (defaultAlias: string) => await inquirer.input({
  message: 'Target profile name',
  default: defaultAlias,
})

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

  async source(profileConfig: LocalProfilesConfig): Promise<{ alias: string; location: string; driver?: string }> {
    const localProfileEntry = await profileConfig.get(this.flags.profile, { throwOnNotFound: false })
    if (!localProfileEntry) {
      throw new Error(`No current profile, specify the source alias with ${text.code(`--${CopyProfile.flags.profile.name}`)}`)
    }
    const { alias, location, info: { driver } } = localProfileEntry
    ux.info(`Copying current profile ${text.code(alias)} from ${text.code(location)}`)
    return { alias, location, driver }
  }

  async target(source: { alias: string; driver?: string }): Promise<{ location: string; alias: string }> {
    const { 'target-location': targetLocation, 'target-storage': targetStorage } = this.flags
    const fsType = targetLocation?.fsType ?? targetStorage ?? await chooseFsType({ driver: source.driver })
    const alias = this.flags['target-name'] ?? await chooseTargetAlias(`${source.alias}-${fsType}`)
    return { alias, location: targetLocation?.location ?? await chooseFs[fsType]({ profileAlias: alias }) }
  }

  async run(): Promise<unknown> {
    const profileConfig = loadProfileConfig(this.config)
    const source = await this.source(profileConfig)
    const target = await this.target(source)
    await profileConfig.copy(source, target, Object.keys(machineDrivers), this.flags.use)

    ux.info(text.success(`Profile ${text.code(source.alias)} copied to ${text.code(target.location)} as ${text.code(target.alias)}`))

    return { source, target }
  }
}
