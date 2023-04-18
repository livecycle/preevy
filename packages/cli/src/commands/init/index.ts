import { Flags, Args, ux } from '@oclif/core'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { pickBy } from 'lodash'
import BaseCommand from '../../base-command'
import { DriverFlagName, DriverName, machineDrivers } from '../../lib/machine'
import { suggestDefaultUrl } from '../../lib/store/fs/s3'

export default class Init extends BaseCommand {
  static description = 'Initialize or import a new profile'

  static args = {
    'profile-alias': Args.string({
      description: 'Alias of the profile',
      required: false,
      default: 'default',
    }),
  }

  static flags = {
    from: Flags.string({
      description: 'Import profile from existing path',
      char: 'f',
    }),
  }

  async run(): Promise<unknown> {
    const existingProfiles = await this.profileConfig.list()
    let profileAlias = this.args['profile-alias']
    const profileExists = existingProfiles.find(p => p.alias === profileAlias)
    if (profileExists) {
      ux.info(`Profile ${profileAlias} already exists`)
      ux.info('Use `init <profile-alias>` to create a new profile')
      return undefined
    }

    if (this.flags.from) {
      await this.config.runCommand('profile:import', [this.flags.from, '--name', profileAlias])
    } else {
      if (profileExists) {
        if (profileAlias !== 'default') {
          throw new Error(`Profile ${profileAlias} already exists`)
        }
        profileAlias = await inquirer.prompt<{
            profileName: string
          }>([{
            type: 'input',
            name: 'profileAlias',
            message: 'What is the name of your profile?',
          }])
      }

      const { driver } = await inquirer.prompt<{
          driver: DriverName
        }>([
          {
            type: 'list',
            name: 'driver',
            message: 'Which cloud provider do you want to use?',
            choices: [
              { value: 'lightsail', name: 'AWS Lightsail' },
              { value: 'gce', name: 'Google Compute Engine' },
            ],
          }])

      const driverStatic = machineDrivers[driver]

      type DFS = (typeof driverStatic)['flags']

      const requiredFlags = pickBy(
        machineDrivers[driver].flags,
        flag => (flag as { required: boolean }).required,
      ) as DFS

      const questions = Object.entries(requiredFlags).map(([key, flag]) => ({
        type: 'input',
        name: key,
        message: flag.description,
        default: ('flagHint' in driverStatic)
          ? driverStatic.flagHint(key as DriverFlagName<DriverName, 'flags'>)
          : undefined,
      }))

      const driverFlags = await inquirer.prompt<Record<string, string>>(questions)
      const { locationType } = await inquirer.prompt<{
          locationType: string
        }>([
          {
            type: 'list',
            name: 'locationType',
            message: 'Where do you want to store the profile?',
            default: 'local',
            choices: [
              { value: 's3', name: 'AWS S3' },
              { value: 'local', name: 'local' },
            ],
          }])
      let location: string
      if (locationType === 's3') {
        const { s3Url } = await inquirer.prompt<{
              s3Url: string
            }>([{
              type: 'input',
              name: 's3Url',
              message: `What is the S3 URL? ${chalk.reset.italic(`(format: s3://${chalk.yellowBright('[bucket]')}?region=${chalk.yellowBright('[region]')})`)}`,
              default: await suggestDefaultUrl(profileAlias), // might worth generating profile id?
            }])

        location = s3Url
      } else {
        location = `local://${profileAlias}`
      }

      await this.config.runCommand('profile:create', ['--log-level', this.flags['log-level'] ?? 'info', profileAlias, location, '--driver', driver, ...Object.entries(driverFlags).map(([key, value]) => `--${driver}-${key}=${value}`)])
    }
    this.log('Initialized profile')

    return undefined
  }
}
