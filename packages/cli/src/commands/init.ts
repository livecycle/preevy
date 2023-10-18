import { Flags, Args, ux } from '@oclif/core'
import inquirer from 'inquirer'
import confirm from '@inquirer/confirm'
import { defaultBucketName as gsDefaultBucketName, defaultProjectId as defaultGceProjectId } from '@preevy/driver-gce'
import { defaultBucketName as s3DefaultBucketName, AWS_REGIONS, awsUtils } from '@preevy/driver-lightsail'
import { BaseCommand, text } from '@preevy/cli-common'
import { EOL } from 'os'
import { Flag } from '@oclif/core/lib/interfaces'
import { DriverName, formatDriverFlagsToArgs, machineDrivers } from '../drivers'
import { loadProfileConfig } from '../profile-command'
import ambientAwsAccountId = awsUtils.ambientAccountId

const chooseDriver = async () => (
  await inquirer.prompt<{ driver: DriverName }>([
    {
      type: 'list',
      name: 'driver',
      message: 'Which cloud provider do you want to use?',
      choices: [
        { value: 'lightsail', name: 'AWS Lightsail' },
        { value: 'gce', name: 'Google Compute Engine' },
        { value: 'azure', name: 'Microsoft Azure Virtual Machines' },
        { value: 'kube-pod', name: 'Kubernetes' },
      ],
    },
  ])
).driver

const locationTypes = ['local', 's3', 'gs'] as const
type LocationType = typeof locationTypes[number]

const chooseLocationType = async () => (
  await inquirer.prompt<{ locationType: LocationType }>([
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
).locationType

type LocationFactory = (opts: {
  profileAlias: string
  driver: DriverName
  driverFlags: Record<string, unknown>
}) => Promise<`${string}://${string}`>

const chooseLocation: Record<LocationType, LocationFactory> = {
  local: async ({ profileAlias }: { profileAlias: string }) => `local://${profileAlias}`,
  s3: async ({ profileAlias, driver, driverFlags }: {
    profileAlias: string
    driver: DriverName
    driverFlags: Record<string, unknown>
  }) => {
    // eslint-disable-next-line no-use-before-define
    const { region, bucket } = await inquirer.prompt<{ region: string; bucket: string }>([
      {
        type: 'list',
        name: 'region',
        message: 'S3 bucket region',
        choices: AWS_REGIONS,
        default: driver === 'lightsail' ? driverFlags.region as string : 'us-east-1',
      },
      {
        type: 'input',
        name: 'bucket',
        message: 'Bucket name',
        default: async (
          answers: Record<string, unknown>
        ) => {
          const accountId = await ambientAwsAccountId(answers.region as string)
          return accountId ? s3DefaultBucketName({ profileAlias, accountId }) : undefined
        },
      },
    ])

    return `s3://${bucket}?region=${region}`
  },
  gs: async ({ profileAlias, driver, driverFlags }: {
    profileAlias: string
    driver: DriverName
    driverFlags: Record<string, unknown>
  }) => {
    // eslint-disable-next-line no-use-before-define
    const { project, bucket } = await inquirer.prompt<{ project: string; bucket: string }>([
      {
        type: 'input',
        name: 'project',
        message: 'Google Cloud project',
        default: driver === 'gce' ? driverFlags['project-id'] : defaultGceProjectId(),
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

    return `gs://${bucket}?project=${project}`
  },
}

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
    const profileConfig = loadProfileConfig(this.config)
    const { 'profile-alias': profileAlias } = this.args
    if (await profileConfig.get(profileAlias, { throwOnNotFound: false })) {
      ux.error([
        `A profile with the alias ${text.code(profileAlias)} already exists.`,
        `Run ${text.command(this.config, 'profile ls')} to list existing profiles.`,
        `Run ${text.command(this.config, 'profile rm <profile-alias>')} to remove an existing profile.`,
        `Run ${text.command(this.config, 'init <profile-alias>')} to create a profile with a different alias.`,
      ].join(EOL))
    }

    if (this.flags.from) {
      await this.config.runCommand('profile:import', [this.flags.from, '--name', profileAlias, '--use'])
      return undefined
    }

    const driver = await chooseDriver()
    const driverStatic = machineDrivers[driver]

    const driverAnswers = await inquirer.prompt<Record<string, unknown>>(await driverStatic.questions())
    const driverFlags = await driverStatic.flagsFromAnswers(driverAnswers) as Record<string, unknown>

    const locationType = await chooseLocationType()

    const location = await chooseLocation[locationType]({ profileAlias, driver, driverFlags })

    await this.config.runCommand('profile:create', [
      '--use',
      '--log-level', this.flags['log-level'] ?? 'info',
      profileAlias,
      location,
      '--driver', driver,
      ...formatDriverFlagsToArgs(driver, driverStatic.flags as Record<string, Flag<unknown>>, driverFlags),
    ])

    ux.info(text.recommendation('Use Livecycle together with Preevy to enable easy sharing and collaboration of your environments!'))

    if (!await confirm({
      message: 'Would you like to link this profile to a Livecycle account?',
      default: true,
    })) {
      ux.info(`You can later run ${text.command(this.config, 'profile link')} to link this profile to a Livecycle account.`)
      return undefined
    }

    await this.config.runCommand('login')
    await this.config.runCommand('profile:link')

    return undefined
  }
}
