import * as k8s from '@kubernetes/client-node'
import { ensureDefined, extractDefined } from '@preevy/core'
import objectKindUrl from './url'

const waiter = ({ watcher, client }: { watcher: k8s.Watch; client: k8s.KubernetesObjectApi }) => {
  const urlGetter = objectKindUrl(client)

  const waitForEvent = async <T extends k8s.KubernetesObject>(
    o: T,
    eventPredicate: (phase: string, apiObj: T) => boolean = () => true,
  ) => {
    const path = new URL(await urlGetter(o)).pathname
    const { name, namespace } = ensureDefined(extractDefined(o, 'metadata'), 'name', 'namespace')
    let abort: () => void
    return await new Promise<T>(resolve => {
      void watcher.watch(path, {}, (phase, apiObj: T) => {
        const metadata = ensureDefined(extractDefined(apiObj, 'metadata'), 'name')
        if (
          metadata.name === name
          && metadata.namespace === namespace
          && eventPredicate(phase, apiObj)
        ) {
          abort()
          resolve(apiObj)
        }
      }, () => undefined).then(req => { abort = req.abort.bind(req) })
    })
  }

  const waitForDeletion = <T extends k8s.KubernetesObject>(
    o: T,
  ) => waitForEvent(o, phase => phase === 'DELETED')

  return {
    waitForDeletion,
    waitForEvent,
  }
}

export default waiter
