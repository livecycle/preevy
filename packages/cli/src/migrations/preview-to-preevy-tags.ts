import { Instance, InstanceSnapshot, KeyPair, Lightsail, Tag } from '@aws-sdk/client-lightsail'
import { asyncToArray } from 'iter-tools-es'
import { paginationIterator } from '../lib/aws-utils/pagination'

const region = 'eu-central-1'

const ls = new Lightsail({ region })

const replaceTags = async (resource: { name?: string; tags?: Tag[] }) => {
  const tagsToEdit = (resource.tags || []).filter(tag => tag.key?.startsWith('preview-'))
  await Promise.all(
    tagsToEdit.map(tag => [
      ls.tagResource({ resourceName: resource.name, tags: [{ key: (tag.key as string).replace('preview-', 'preevy-'), value: tag.value }] }),
    ]),
  )
  await ls.untagResource({ resourceName: resource.name, tagKeys: tagsToEdit.map(tag => tag.key as string) })
}

void (async () => {
  const resources = await Promise.all([
    ...(await asyncToArray(paginationIterator(pageToken => ls.getInstances({ pageToken }), 'instances')) as Instance[]),
    ...(await asyncToArray(paginationIterator(pageToken => ls.getKeyPairs({ pageToken }), 'keyPairs')) as KeyPair[]),
    ...(await asyncToArray(paginationIterator(pageToken => ls.getInstanceSnapshots({ pageToken }), 'instanceSnapshots')) as InstanceSnapshot[]),
  ])

  await Promise.all(
    resources.map(replaceTags)
  )
})()
