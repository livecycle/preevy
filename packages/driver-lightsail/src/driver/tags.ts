import { inspect } from 'util'
import { extractDefined } from '@preevy/core'

export const CURRENT_MACHINE_VERSION = 'm-2023-08-02'

export const TAGS = {
  PROFILE_ID: 'preevy-profile-id',
  MACHINE_VERSION: 'preevy-machine-version',
  KEYPAIR_ALIAS: 'preevy-keypair-alias',
  ENV_ID: 'preevy-env-id',
}

type Tag = { key: string; value: string }
type ArrayTag = [key: string, value: string]
type HasTag = Partial<Tag>

export const requiredTag = (tags: Partial<Tag>[], key: string) => {
  const found = tags.find(t => t.key === key)
  if (!found) {
    throw new Error(`Could not find required tag ${key} in ${inspect(tags)}`)
  }
  return extractDefined(found, 'value')
}

type TagPredicate = (tag: HasTag) => boolean
type TagsPredicate = (tags: HasTag[]) => boolean

const tagPredicate = ({ key, value }: {
  key: string
  value: string
}): TagPredicate => (tag: HasTag) => tag.key === key && tag.value === value

const normalizeTag = (tag: Tag | ArrayTag): Tag => (
  Array.isArray(tag) ? { key: tag[0], value: tag[1] } : tag
)

const allTagsPredicate = (
  ...tagsToFind: (Tag | ArrayTag)[]
): TagsPredicate => {
  const predicates = tagsToFind.map(normalizeTag).map(tagPredicate)
  return tags => predicates.every(predicate => tags.some(predicate))
}

export type InstanceTags = { profileId: string; envId?: string; version?: string }

export const instanceTags = (
  { profileId, envId, version }: InstanceTags,
) => [
  [TAGS.PROFILE_ID, profileId],
  envId && [TAGS.ENV_ID, envId],
  version && [TAGS.MACHINE_VERSION, version],
].filter(Boolean).map(t => normalizeTag(t as [string, string]))

export const instanceTagsPredicate = (
  tags: InstanceTags,
  ...extraTags: Tag[]
) => allTagsPredicate(
  ...instanceTags(tags),
  ...extraTags
)

export type SnapshotTags = { profileId: string; version?: string }

export const snapshotTags = ({ profileId, version }: SnapshotTags) => [
  [TAGS.PROFILE_ID, profileId],
  version && [TAGS.MACHINE_VERSION, version],
].filter(Boolean).map(t => normalizeTag(t as [string, string]))

export const snapshotTagsPredicate = (
  tags: SnapshotTags,
  ...extraTags: Tag[]
) => allTagsPredicate(
  ...snapshotTags(tags),
  ...extraTags,
)

export type KeypairTags = { alias?: string; profileId: string }

export const keypairTags = ({ alias, profileId }: KeypairTags) => [
  [TAGS.PROFILE_ID, profileId],
  alias && [TAGS.KEYPAIR_ALIAS, alias],
].filter(Boolean).map(t => normalizeTag(t as [string, string]))

export const keypairTagsPredicate = (
  tags: KeypairTags,
  ...extraTags: Tag[]
) => allTagsPredicate(
  ...keypairTags(tags),
  ...extraTags,
)
