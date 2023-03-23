import { simpleEmitter } from './simple'

const EVENT = 'state'

export const stateEmitter = <T>(initial?: T) => {
  const emitter = simpleEmitter<{ [EVENT]: T }>()

  let current: T
  const first = new Promise<void>(resolve => {
    void emitter.addListener(EVENT, state => {
      current = state
      resolve()
    })
  })

  const self = {
    emit: (state: T) => emitter.emit(EVENT, state),
    addListener: (listener: (state: T) => void) => emitter.addListener(EVENT, listener),
    addOneTimeListener: (listener: (state: T) => void) => emitter.addOneTimeListener(EVENT, listener),
    current: async () => first.then(() => current),
    next: () => emitter.toPromise(EVENT),
    filter: async (predicate: (state: T) => boolean) => {
      let state: T = await self.current()
      while (!predicate(state)) {
        // eslint-disable-next-line no-await-in-loop
        state = await self.next()
      }

      return state
    },
  }

  if (initial !== undefined) {
    self.emit(initial)
  }

  return self
}

export type StateEmitter<T> = ReturnType<typeof stateEmitter<T>>
export type StateEmitterConsumer<T> = Omit<StateEmitter<T>, 'emit'>
