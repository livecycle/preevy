import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

export const defaultBucketName = (
  { profileAlias, accountId }: { profileAlias: string; accountId: string },
) => `preevy-${accountId}-${profileAlias}`

const ensureBucketExists = async (containerName: string, connectionString: string) => {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  const containerClient: ContainerClient = blobServiceClient.getContainerClient(containerName)
  const exists = await containerClient.exists()

  if (!exists) {
    await containerClient.create()
  }
  return containerName
}

export const azureStorageBlobFs = async () => {
  await ensureBucketExists('someName', 'someConnection')
}
