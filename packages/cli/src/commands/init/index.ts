import { Flags, Args, ux } from '@oclif/core'
import inquirer from 'inquirer'
import BaseCommand from '../../base-command'
import { DriverName, machineDrivers } from '../../lib/machine'
import { defaultBucketName as s3DefaultBucketName } from '../../lib/store/fs/s3'
import { defaultBucketName as gsDefaultBucketName } from '../../lib/store/fs/google-cloud-storage'
import { defaultProjectId } from '../../lib/machine/drivers/gce/client'
import { REGIONS } from '../../lib/machine/drivers/lightsail/client'
import { ambientAccountId } from '../../lib/aws-utils/account-id'

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

      const driverAnswers = await inquirer.prompt<Record<string, unknown>>(await driverStatic.questions())
      const driverFlags = await driverStatic.flagsFromAnswers(driverAnswers) as Record<string, unknown>

      const { locationType } = await inquirer.prompt<{ locationType: string }>([
        {
          type: 'list',
          name: 'locationType',
          message: 'Where do you want to store the profile?',
          default: 'local',
          choices: [
            { value: 'local', name: 'local file' },
            { value: 's3', name: 'AWS S3' },
            { value: 'gs', name: 'Google Cloud Storage' },
          ],
        },
      ])

      let location: string
      if (locationType === 's3') {
        const { region, bucket } = await inquirer.prompt<{ region: string; bucket: string }>([
          {
            type: 'list',
            name: 'region',
            message: 'S3 bucket region',
            choices: REGIONS,
            default: driver === 'lightsail' ? driverFlags.region as string : 'us-east-1',
          },
          {
            type: 'input',
            name: 'bucket',
            message: 'Bucket name',
            default: async (
              answers: Record<string, unknown>
            ) => {
              const accountId = await ambientAccountId(answers.region as string)
              return accountId ? s3DefaultBucketName({ profileAlias, accountId }) : undefined
            },
          },
        ])

        location = `s3://${bucket}?region=${region}`
      } else if (locationType === 'gs') {
        const { project, bucket } = await inquirer.prompt<{ project: string; bucket: string }>([
          {
            type: 'input',
            name: 'project',
            message: 'Google Cloud project',
            default: driver === 'gce' ? driverFlags['project-id'] : defaultProjectId(),
          },
          {
            type: 'input',
            name: 'bucket',
            message: 'Bucket name',
            default: (
              answers: Record<string, unknown>,
            ) => gsDefaultBucketName({ profileAlias, project: answers.project as string }),
          },
        ])

        location = `gs://${bucket}?project=${project}`
      } else {
        location = `local://${profileAlias}`
      }

      await this.config.runCommand('profile:create', ['--log-level', this.flags['log-level'] ?? 'info', profileAlias, location, '--driver', driver, ...Object.entries(driverFlags).map(([key, value]) => `--${driver}-${key}=${value}`)])
    }
    this.log('Initialized profile')

    return undefined
  }
}
