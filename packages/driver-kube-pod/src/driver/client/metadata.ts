import * as k8s from '@kubernetes/client-node'
import { ensureDefined, extractDefined, randomString, truncatePrefix } from '@preevy/core'
import { pick } from 'lodash-es'
import { tryParseJson } from '@preevy/common'
import { sanitizeLabel, sanitizeLabels } from './labels.js'
import { HasMetadata, Package } from './common.js'
import { KubernetesType } from './dynamic/index.js'

export const MAX_LABEL_LENGTH = 63

const PREEVY_PREFIX = 'preevy.dev' as const

export const LABELS = {
  PROFILE_ID: `${PREEVY_PREFIX}/profile-id`,
  ENV_ID: `${PREEVY_PREFIX}/env-id`,
  INSTANCE: `${PREEVY_PREFIX}/instance`,
  DELETED: `${PREEVY_PREFIX}/deleted`,
  COMPONENT: 'app.kubernetes.io/component',
} as const

export const DOCKER_HOST_VALUE = 'docker-host'

const TRUE_VALUE = 'true'

export const ANNOTATIONS = {
  PROFILE_ID: `${PREEVY_PREFIX}/profile-id`,
  ENV_ID: `${PREEVY_PREFIX}/env-id`,
  CREATED_AT: `${PREEVY_PREFIX}/created-at`,
  TEMPLATE_HASH: `${PREEVY_PREFIX}/template-hash`,
  KUBERNETES_KIND: `${PREEVY_PREFIX}/kubernetes-kind`,
  KUERBETES_API_VERSION: `${PREEVY_PREFIX}/kubernetes-api-version`,
  DEPLOYMENT_REVISION: 'deployment.kubernetes.io/revision',
  ALL_TYPES: `${PREEVY_PREFIX}/all-types`,
}

export const markObjectAsDeleted = (
  spec: k8s.KubernetesObject,
): k8s.KubernetesObject => ({
  apiVersion: spec.apiVersion,
  kind: spec.kind,
  metadata: {
    name: spec.metadata?.name,
    namespace: spec.metadata?.namespace,
    labels: {
      ...spec.metadata?.labels,
      [LABELS.DELETED]: TRUE_VALUE,
    },
  },
})

export type StoredType = Pick<KubernetesType, 'apiVersion' | 'kind'>

export const readAllTypesAnnotation = (
  o: k8s.KubernetesObject,
) => {
  const an = o?.metadata?.annotations?.[ANNOTATIONS.ALL_TYPES]
  return an ? tryParseJson(an) as StoredType[] : undefined
}

export const addAllTypesAnnotation = (
  o: k8s.KubernetesObject,
  types: StoredType[]
): k8s.KubernetesObject => {
  o.metadata ??= {}
  o.metadata.annotations ??= {}
  o.metadata.annotations[ANNOTATIONS.ALL_TYPES] = JSON.stringify(
    types.map(t => pick<StoredType>(t, 'apiVersion', 'kind'))
  )
  return o
}

export const addEnvMetadata = (
  { profileId, envId, createdAt, instance, package: { name, version }, templateHash }: {
    profileId: string
    envId: string
    createdAt: Date
    instance: string
    package: Package
    templateHash: string
  },
) => (
  spec: k8s.KubernetesObject,
  index: number,
) => {
  spec.metadata ??= {}
  spec.metadata.labels ??= {}
  spec.metadata.annotations ??= {}
  Object.assign(spec.metadata.labels, sanitizeLabels({
    [LABELS.PROFILE_ID]: profileId,
    [LABELS.ENV_ID]: envId,
    [LABELS.INSTANCE]: instance,
    'app.kubernetes.io/instance': instance,
    'app.kubernetes.io/managed-by': name,
    'app.kubernetes.io/name': envId,
    'app.kubernetes.io/part-of': profileId,
    'app.kubernetes.io/version': version,
    'internal.config.kubernetes.io/index': index.toString(),
  }))
  Object.assign(spec.metadata.annotations, {
    [ANNOTATIONS.ENV_ID]: envId,
    [ANNOTATIONS.PROFILE_ID]: profileId,
    [ANNOTATIONS.CREATED_AT]: createdAt.toISOString(),
    [ANNOTATIONS.TEMPLATE_HASH]: templateHash,
    [ANNOTATIONS.KUBERNETES_KIND]: spec.kind,
    ...spec.apiVersion ? { [ANNOTATIONS.KUERBETES_API_VERSION]: spec.apiVersion } : undefined,
  })
  return spec
}

const extractLabel = (
  o: HasMetadata,
  label: keyof typeof LABELS,
) => extractDefined(extractDefined(extractDefined(o, 'metadata'), 'labels'), LABELS[label])

const extractAnnotation = (
  o: HasMetadata,
  annotation: keyof typeof ANNOTATIONS,
) => extractDefined(extractDefined(extractDefined(o, 'metadata'), 'annotations'), ANNOTATIONS[annotation])

export const extractInstance = (o: HasMetadata) => extractLabel(o, 'INSTANCE')
export const extractEnvId = (o: HasMetadata) => extractAnnotation(o, 'ENV_ID')
export const extractName = (o: HasMetadata) => extractDefined(extractDefined(o, 'metadata'), 'name')
export const extractNamespace = (o: HasMetadata) => extractDefined(extractDefined(o, 'metadata'), 'namespace')
export const extractNameAndNamespace = (o: HasMetadata) => ensureDefined(extractDefined(o, 'metadata'), 'namespace', 'name')
export const extractTemplateHash = (o: HasMetadata) => extractAnnotation(o, 'TEMPLATE_HASH')
export const extractCreatedAt = (o: HasMetadata) => extractAnnotation(o, 'CREATED_AT')

const eqSelector = (key: string, value: string) => `${key}=${value}`
const neqSelector = (key: string, value: string) => `${key}!=${value}`

export const instanceSelector = ({ instance }: { instance: string }) => ({
  labelSelector: eqSelector(LABELS.INSTANCE, instance),
})

export const envSelector = (
  { profileId, envId, deleted, dockerHost = false }: {
    profileId: string
    envId: string
    deleted?: boolean
    dockerHost?: boolean
  },
) => ({
  labelSelector: [
    eqSelector(LABELS.PROFILE_ID, sanitizeLabel(profileId)),
    eqSelector(LABELS.ENV_ID, sanitizeLabel(envId)),
    deleted !== undefined ? (deleted ? eqSelector : neqSelector)(LABELS.DELETED, TRUE_VALUE) : undefined,
    dockerHost ? eqSelector(LABELS.COMPONENT, DOCKER_HOST_VALUE) : undefined,
  ].filter(Boolean).join(','),
})

export const profileSelector = ({ profileId }: { profileId: string }) => ({
  labelSelector: eqSelector(LABELS.PROFILE_ID, sanitizeLabel(profileId)),
})

export const isDockerHostStatefulSet = (s: k8s.KubernetesObject) => s.kind === 'StatefulSet'
    && s.metadata?.labels?.[LABELS.COMPONENT] === DOCKER_HOST_VALUE

// https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
const sanitizeName = (s: string) => s
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/^[^a-z]/, firstChar => `a${firstChar}`) // prefix with alphabetic if first char is not alphabetic
  .replace(/[^a-z0-9]$/, lastChar => `${lastChar}z`) // suffix with alphanumeric if last char is not alphanumeric

const RANDOM_ID_SPARE_LENGTH = 15 // give room for StatefulSet pod name suffix
const MAX_NAME_LENGTH = 63

export const envRandomName = (
  { envId, profileId }: { envId: string; profileId: string },
) => truncatePrefix(
  sanitizeName([profileId, envId].join('-')),
  randomString.lowercaseNumeric(5),
  MAX_NAME_LENGTH - RANDOM_ID_SPARE_LENGTH,
)
