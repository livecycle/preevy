type InstanceMetadata = {
  envId: string
  profileId: string
}

export const metadataKey = 'preevy-env'

export const serializeMetadata = (metadata: InstanceMetadata) => JSON.stringify(metadata)
export const deserializeMetadata = (metadata: string) => JSON.parse(metadata) as InstanceMetadata
