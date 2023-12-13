import { fsTypeFromUrl, localFsFromUrl } from '@preevy/core'
import { googleCloudStorageFs, defaultBucketName as gsDefaultBucketName, defaultProjectId as defaultGceProjectId } from '@preevy/driver-gce'
import { s3fs, defaultBucketName as s3DefaultBucketName, awsUtils, S3_REGIONS } from '@preevy/driver-lightsail'
import inquirer from 'inquirer'
import inquirerAutoComplete from 'inquirer-autocomplete-prompt'
import { DriverName } from './drivers.js'
import ambientAwsAccountId = awsUtils.ambientAccountId

inquirer.registerPrompt('autocomplete', inquirerAutoComplete)

export const fsFromUrl = async (url: string, localBaseDir: string) => {
  const fsType = fsTypeFromUrl(url)
  if (fsType === 'local') {
    return localFsFromUrl(localBaseDir, url)
  }
  if (fsType === 's3') {
    // eslint false positive here on case-sensitive filesystems due to unknown type
    // eslint-disable-next-line @typescript-eslint/return-await
    return await s3fs(url)
  }
  if (fsType === 'gs') {
    // eslint false positive here on case-sensitive filesystems due to unknown type
    // eslint-disable-next-line @typescript-eslint/return-await
    return await googleCloudStorageFs(url)
  }
  throw new Error(`Unsupported URL type: ${fsType}`)
}

export const fsTypes = ['local', 's3', 'gs'] as const
export type FsType = typeof fsTypes[number]
export const isFsType = (s: string): s is FsType => fsTypes.includes(s as FsType)

const defaultFsType = (driver?: string): FsType => {
  if (driver as DriverName === 'lightsail') {
    return 's3'
  }
  if (driver as DriverName === 'gce') {
    return 'gs'
  }
  return 'local'
}

export const chooseFsType = async ({ driver }: { driver?: string }) => (
  await inquirer.prompt<{ locationType: FsType }>([
    {
      type: 'list',
      name: 'locationType',
      message: 'Where do you want to store the profile?',
      default: defaultFsType(driver),
      choices: [
        { value: 'local', name: 'local file' },
        { value: 's3', name: 'AWS S3' },
        { value: 'gs', name: 'Google Cloud Storage' },
      ],
    },
  ])
).locationType

type URL = `${string}://${string}`

export type FsChooser = (opts: {
  profileAlias: string
  driver?: { name: DriverName; flags: Record<string, unknown> }
}) => Promise<URL>

export const chooseFs: Record<FsType, FsChooser> = {
  local: async ({ profileAlias }: { profileAlias: string }) => `local://${profileAlias}`,
  s3: async ({ profileAlias, driver }: {
    profileAlias: string
    driver?: { name: DriverName; flags: Record<string, unknown> }
  }) => {
    // eslint-disable-next-line no-use-before-define
    const { region, bucket } = await inquirer.prompt<{ region: string; bucket: string }>([
      {
        type: 'autocomplete',
        name: 'region',
        message: 'S3 bucket region',
        source: async (_opts, input) => S3_REGIONS.filter(r => !input || r.includes(input.toLowerCase())),
        default: driver?.name === 'lightsail' && S3_REGIONS.includes(driver.flags.region as string)
          ? driver.flags.region as string
          : 'us-east-1',
        suggestOnly: true,
        filter: i => i.toLowerCase(),
      } as inquirerAutoComplete.AutocompleteQuestionOptions,
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
  gs: async ({ profileAlias, driver }: {
    profileAlias: string
    driver?: { name: DriverName; flags: Record<string, unknown> }
  }) => {
    // eslint-disable-next-line no-use-before-define
    const { project, bucket } = await inquirer.prompt<{ project: string; bucket: string }>([
      {
        type: 'input',
        name: 'project',
        message: 'Google Cloud project',
        default: driver?.name === 'gce' ? driver.flags['project-id'] : defaultGceProjectId(),
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
