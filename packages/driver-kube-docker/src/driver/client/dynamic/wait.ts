import * as k8s from '@kubernetes/client-node'
import { ensureDefined, extractDefined } from '@preevy/core'
import { inspect } from 'util'
import objectKindUrl from './url'

const waiter = ({ watcher, client }: { watcher: k8s.Watch; client: k8s.KubernetesObjectApi }) => {
  const urlGetter = objectKindUrl(client)

  const waitForEvent = async <T extends k8s.KubernetesObject>(
    o: T,
    objPredicate: (apiObj: T) => boolean,
    phasePredicate: (phase: string) => boolean = () => true,
  ) => {
    if (objPredicate(o)) {
      return o
    }
    const path = new URL(await urlGetter(o)).pathname
    const { name } = ensureDefined(extractDefined(o, 'metadata'), 'name')
    let abort: () => void
    return await new Promise<T>(resolve => {
      console.log('watching path', path, name)
      void watcher.watch(path, {}, (phase, apiObj: T) => {
        const metadata = ensureDefined(extractDefined(apiObj, 'metadata'), 'name')
        console.log('watch event', phase, metadata.name, metadata.resourceVersion)
        console.log('conditions', [
          metadata.name === name,
          phasePredicate(phase),
          objPredicate(apiObj),
        ])
        if (
          metadata.name === name
          && phasePredicate(phase)
          && objPredicate(apiObj)
        ) {
          abort()
          resolve(apiObj)
        }
      }, () => undefined).then(req => { abort = req.abort.bind(req) })
    })
  }

  const waitForDeletion = <T extends k8s.KubernetesObject>(
    o: T,
  ) => waitForEvent(o, obj => !obj, phase => phase === 'DELETED')

  return {
    waitForDeletion,
    waitForEvent,
  }
}

export default waiter
