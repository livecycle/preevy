import * as k8s from '@kubernetes/client-node'
import { ensureDefined, extractDefined } from '@preevy/core'
import { HasMetadata, urls } from './common'

export const waiter = (watcher: k8s.Watch) => {
  const waitForEvent = <T extends HasMetadata>(
    url: string,
    name: string,
    resourceVersion: string,
    predicate: (phase: string, apiObj: T) => boolean
  ) => new Promise<void>(resolve => {
    void watcher.watch(url, {}, (phase, apiObj: T) => {
      const metadata = ensureDefined(extractDefined(apiObj, 'metadata'), 'name', 'resourceVersion')
      if (metadata.name === name && metadata.resourceVersion === resourceVersion && predicate(phase, apiObj)) {
        resolve()
      }
    }, () => undefined)
  })

  const waitForDeletion = (
    url: string,
    name: string,
    resourceVersion: string
  ) => waitForEvent(url, name, resourceVersion, phase => phase === 'DELETED')

  const waitForDeploymentDeletion = ({ name, namespace, resourceVersion }: {
    name: string
    namespace: string
    resourceVersion: string
  }) => waitForDeletion(urls.deployments(namespace), name, resourceVersion)

  const waitForDeploymentAvailable = ({ name, namespace, resourceVersion }: {
    name: string
    namespace: string
    resourceVersion: string
  }) => waitForEvent<k8s.V1Deployment>(
    urls.deployments(namespace),
    name,
    resourceVersion,
    (phase, d) => phase === 'MODIFIED'
      && Boolean(d.status?.conditions?.some(({ type, status }) => type === 'Available' && status === 'True'))
  )

  return {
    waitForDeploymentAvailable,
    waitForDeploymentDeletion,
    waitForDeletion,
  }
}

export default waiter
