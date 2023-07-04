import * as k8s from '@kubernetes/client-node'
import { extractDefined } from '@preevy/core'
import { labelWithRandomSuffix, sanitizeLabel } from './labels'
import { HasMetadata, Package } from './common'

export const LABELS = {
  PROFILE_ID: 'preevy.dev/profile-id',
  ENV_ID: 'preevy.dev/env-id',
  INSTANCE: 'preevy.dev/instance',
  DELETED: 'preevy.dev/deleted',
  DOCKER_HOST: 'app.kubernetes.io/component',
} as const

export const DOCKER_HOST_VALUE = 'docker-host'

const TRUE_VALUE = 'true'

export const ANNOTATIONS = {
  CREATED_AT: 'preevy.dev/created-at',
  TEMPLATE_HASH: 'preevy.dev/template-hash',
  KUBERNETES_KIND: 'preevy.dev/kubernetes-kind',
  KUERBETES_API_VERSION: 'preev.dev/kubernetes-api-version',
  DEPLOYMENT_REVISION: 'deployment.kubernetes.io/revision',
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
  Object.assign(spec.metadata.labels, {
    [LABELS.PROFILE_ID]: profileId,
    [LABELS.ENV_ID]: envId,
    [LABELS.INSTANCE]: instance,
    'app.kubernetes.io/instance': instance,
    'app.kubernetes.io/managed-by': sanitizeLabel(name),
    'app.kubernetes.io/name': envId,
    'app.kubernetes.io/part-of': profileId,
    'app.kubernetes.io/version': version,
    'internal.config.kubernetes.io/index': index.toString(),
  })
  Object.assign(spec.metadata.annotations, {
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
export const extractEnvId = (o: HasMetadata) => extractLabel(o, 'ENV_ID')
export const extractName = (o: HasMetadata) => extractDefined(extractDefined(o, 'metadata'), 'name')
export const extractNamespace = (o: HasMetadata) => extractDefined(extractDefined(o, 'metadata'), 'namespace')
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
    eqSelector(LABELS.PROFILE_ID, profileId),
    eqSelector(LABELS.ENV_ID, envId),
    deleted !== undefined ? (deleted ? eqSelector : neqSelector)(LABELS.DELETED, TRUE_VALUE) : undefined,
    dockerHost ? eqSelector(LABELS.DOCKER_HOST, DOCKER_HOST_VALUE) : undefined,
  ].filter(Boolean).join(','),
})

export const profileSelector = ({ profileId }: { profileId: string }) => ({
  labelSelector: eqSelector(LABELS.PROFILE_ID, profileId),
})

export const isDockerHostDeployment = (s: k8s.KubernetesObject) => s.kind === 'Deployment'
    && s.metadata?.labels?.[LABELS.DOCKER_HOST] === DOCKER_HOST_VALUE

const RANDOM_ID_SPARE_LENGTH = 10

export const envRandomId = (
  { envId, profileId }: { envId: string; profileId: string },
) => labelWithRandomSuffix([profileId, envId], RANDOM_ID_SPARE_LENGTH)
