import { inspect } from 'util'
import { extractDefined } from '../../../aws-utils/nulls'

export const CURRENT_MACHINE_VERSION = 'm-2023-02-16'

export const KEYPAIR_TAGS = {
  PROFILE_ID: 'preview-profile-id',
  ALIAS: 'preview-keypair-alias',
}

export const INSTANCE_TAGS = {
  MACHINE_VERSION: 'preview-machine-version',
  ENV_ID: 'preview-env-id',
  PROFILE_ID: 'preview-profile-id',
}

const tagPredicate = ({ key, value }: {
  key: string
  value: string
}) => (tag: { key?: string; value?: string }) => tag.key === key && tag.value === value

export const allTagsPredicate = (...tagsToFind: { key: string; value: string }[]) => (
  tags: { key?: string; value?: string }[],
) => {
  const predicates = tagsToFind.map(tagPredicate)
  return predicates.every(predicate => tags.some(predicate))
}

export const requiredTag = (tags: { key?: string; value?: string }[], key: string) => {
  const found = tags.find(t => t.key === key)
  if (!found) {
    throw new Error(`Could not find required tag ${key} in ${inspect(tags)}`)
  }
  return extractDefined(found, 'value')
}
