import { fsTypeFromUrl, localFsFromUrl } from '@preevy/core'
import { prompts } from '@preevy/cli-common'
import { googleCloudStorageFs, defaultBucketName as gsDefaultBucketName, defaultProjectId as defaultGceProjectId } from '@preevy/driver-gce'
import { s3fs, defaultBucketName as s3DefaultBucketName, awsUtils, S3_REGIONS } from '@preevy/driver-lightsail'
import * as inquirer from '@inquirer/prompts'
import * as azure from '@preevy/driver-azure'
import inquirerAutoComplete from 'inquirer-autocomplete-standalone'
import { asyncFind, asyncTake, asyncToArray } from 'iter-tools-es'
import { DriverName } from './drivers.js'
import ambientAwsAccountId = awsUtils.ambientAccountId

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
  if (fsType === 'azblob') {
    // eslint false positive here on case-sensitive filesystems due to unknown type
    // eslint-disable-next-line @typescript-eslint/return-await
    return await azure.fs.azureBlobStorageFs(url)
  }
  throw new Error(`Unsupported URL type: ${fsType}`)
}

export const fsTypes = ['local', 's3', 'gs', 'azblob'] as const
export type FsType = typeof fsTypes[number]
export const isFsType = (s: string): s is FsType => fsTypes.includes(s as FsType)

const defaultFsType = (driver?: string): FsType => {
  if (driver as DriverName === 'lightsail') {
    return 's3'
  }
  if (driver as DriverName === 'gce') {
    return 'gs'
  }
  if (driver as DriverName === 'azure') {
    return 'azblob'
  }
  return 'local'
}

export const chooseFsType = async ({ driver }: { driver?: string }) => await inquirer.select({
  message: 'Where do you want to store the profile?',
  default: defaultFsType(driver),
  choices: [
    { value: 'local', name: 'local file' },
    { value: 's3', name: 'AWS S3' },
    { value: 'gs', name: 'Google Cloud Storage' },
    { value: 'azblob', name: 'Microsoft Azure Blob Storage' },
  ],
}) as FsType

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
    const region = await inquirerAutoComplete<string>({
      message: 'S3 bucket region',
      source: async input => S3_REGIONS
        .filter(r => !input || r.includes(input.toLowerCase()))
        .map(value => ({ value })),
      default: driver?.name === 'lightsail' && S3_REGIONS.includes(driver.flags.region as string)
        ? driver.flags.region as string
        : 'us-east-1',
      suggestOnly: true,
      transformer: i => i.toLowerCase(),
    })
    const accountId = await ambientAwsAccountId(region)
    const defaultBucket = accountId ? s3DefaultBucketName({ profileAlias, accountId }) : undefined
    const bucket = await inquirer.input({ message: 'Bucket name', default: defaultBucket })

    return `s3://${bucket}?region=${region}`
  },
  gs: async ({ profileAlias, driver }: {
    profileAlias: string
    driver?: { name: DriverName; flags: Record<string, unknown> }
  }) => {
    const defaultProject: string | undefined = driver?.name === 'gce'
      ? driver.flags['project-id'] as string | undefined
      : await defaultGceProjectId()

    const project = await inquirer.input({
      message: 'Google Cloud project',
      default: defaultProject,
    })

    const defaultBucket = gsDefaultBucketName({ profileAlias, project })

    const bucket = await inquirer.input({
      message: 'Bucket name',
      default: defaultBucket,
    })

    return `gs://${bucket}?project=${project}`
  },
  azblob: async ({ profileAlias, driver }: {
    profileAlias: string
    driver?: { name: DriverName; flags: Record<string, unknown> }
  }) => {
    const subscriptionId = driver?.name === 'azure'
      ? driver.flags['subscription-id'] as string
      : await azure.inquireSubscriptionId().catch(() => undefined)

    const pageSize = 7

    const accounts = subscriptionId
      ? await asyncToArray(asyncTake(pageSize - 2, azure.fs.listStorageAccounts({ subscriptionId }))).catch(() => [])
      : []

    const account = await prompts.selectOrSpecify({
      message: 'Storage account name',
      choices: accounts.map(({ name }) => ({ value: name, name })),
      specifyItemLocation: 'bottom',
    })

    const inquireDomain = () => prompts.selectOrSpecify({
      message: 'Storage domain',
      choices: [{ value: azure.fs.DEFAULT_DOMAIN, name: `(default): ${azure.fs.DEFAULT_DOMAIN}` }],
      specifyItem: '(custom)',
      specifyItemLocation: 'bottom',
    })

    const domain = (subscriptionId && accounts.length)
      ? await (async () => {
        const foundAccount = accounts.find(a => a.name === account)
          ?? await asyncFind(({ name }) => name === account, azure.fs.listStorageAccounts({ subscriptionId }))
        return foundAccount?.blobDomain ?? inquireDomain()
      })()
      : await inquireDomain()

    const container = await inquirer.input({
      message: 'Container name',
      default: azure.fs.defaultContainerName({ profileAlias }),
    })

    return azure.fs.toUrl({
      container,
      account,
      domain: domain === azure.fs.DEFAULT_DOMAIN ? undefined : domain,
    })
  },
}
