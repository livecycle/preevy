import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient, RestError } from '@azure/storage-blob'
import { StorageManagementClient } from '@azure/arm-storage'
import { VirtualFS } from '@preevy/core'
import { asyncFilter, asyncMap } from 'iter-tools-es'
import { join } from 'path'

export const DEFAULT_DOMAIN = 'blob.core.windows.net' as const

export const parseUrl = (url: string, defaults: Partial<{ account: string; domain: string }> = {}) => {
  const u = new URL(url)
  if (u.protocol !== 'azblob:') {
    throw new Error('Azure Blob Storage urls must start with azblob://')
  }

  const account = u.searchParams.get('storage_account') ?? defaults?.account
  if (!account) {
    throw new Error(`Missing storage_account in url and no default storage account provided: ${url}`)
  }

  return {
    url: u,
    container: u.hostname,
    account,
    path: u.pathname,
    domain: u.searchParams.get('domain') ?? defaults?.domain ?? DEFAULT_DOMAIN,
  }
}

export const toUrl = (
  { account, domain, container, path }: { account?: string; domain?: string; container: string; path?: string },
) => {
  const u = new URL(`azblob://${container}`)
  u.pathname = path ?? '/'
  if (account) {
    u.searchParams.set('storage_account', account)
  }
  if (domain) {
    u.searchParams.set('domain', domain)
  }
  return u.toString() as `azblob://${string}`
}

export const listContainers = (
  { account, domain }: { account: string; domain?: string },
): AsyncIterable<string> => {
  const client = new BlobServiceClient(`https://${account}.${domain}`, new DefaultAzureCredential())
  const filtered = asyncFilter(({ deleted }) => !deleted, client.listContainers())
  return asyncMap(({ name }) => name, filtered)
}

export const listStorageAccounts = (
  { subscriptionId }: { subscriptionId: string },
): AsyncIterable<{ name: string; blobDomain?: string }> => {
  const client = new StorageManagementClient(new DefaultAzureCredential(), subscriptionId)
  return asyncMap(
    ({ name, primaryEndpoints }) => ({
      name: name as string,
      blobDomain: /(?<=\.)[^/]+/.exec(primaryEndpoints?.blob ?? '')?.toString() ?? undefined,
    }),
    client.storageAccounts.list(),
  )
}

const isNotFoundError = (e: unknown): e is RestError => e instanceof RestError && e.statusCode === 404
const isContainerNotFound = (e: unknown) => isNotFoundError(e) && e.code === 'ContainerNotFound'

const catchNotFoundError = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn()
  } catch (e) {
    if (isNotFoundError(e)) {
      return undefined
    }
    throw e
  }
}

export const containerClient = (url: string) => {
  const { container, account, path, domain } = parseUrl(url)
  return {
    client: new BlobServiceClient(`https://${account}.${domain}`, new DefaultAzureCredential()).getContainerClient(container),
    path,
  }
}

export const azureBlobStorageFs = async (url: string): Promise<VirtualFS> => {
  const { client, path } = containerClient(url)
  await client.createIfNotExists()

  return {
    read: async (filename: string) => {
      const blob = client.getBlobClient(join(path, filename))
      return await catchNotFoundError(() => blob.downloadToBuffer())
    },
    write: async (filename: string, data: Buffer | string) => {
      const blob = client.getBlockBlobClient(join(path, filename))
      await blob.upload(Buffer.isBuffer(data) ? data : Buffer.from(data), data.length)
    },
    delete: async (filename: string) => {
      const blob = client.getBlobClient(join(path, filename))
      await catchNotFoundError(() => blob.delete())
    },
  }
}

export const defaultContainerName = (
  { profileAlias }: { profileAlias: string },
) => ['preevy', profileAlias].join('-')
