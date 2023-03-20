import EventEmitter from 'events'

export const simpleEmitter = <T extends Record<string, unknown>>() => {
  const e = new EventEmitter()
  return {
    addListener: <Event extends keyof T>(event: Event, listener: (data: T[Event]) => void) => {
      e.on(String(event), listener)
      return () => e.removeListener(String(event), listener)
    },
    addOneTimeListener: <Event extends keyof T>(event: Event, listener: (data: T[Event]) => void) => {
      e.once(String(event), listener)
    },
    toPromise: <Event extends keyof T>(event: Event) => new Promise<T[Event]>(resolve => {
      e.once(String(event), resolve)
    }),
    emit: <Event extends keyof T>(event: Event, data: T[Event]) => e.emit(String(event), data),
  }
}

export const simpleRx = <T>() => {
  const emitter = simpleEmitter<{ [simpleRx.event]: T }>()

  let current: T
  const initial = new Promise<void>(resolve => {
    void emitter.addListener(simpleRx.event, state => {
      current = state
      resolve()
    })
  })

  const self = {
    emit: (state: T) => emitter.emit(simpleRx.event, state),
    subscribe: (listener: (state: T) => void) => emitter.addListener(simpleRx.event, listener),
    subscribeOnce: (listener: (state: T) => void) => emitter.addOneTimeListener(simpleRx.event, listener),
    current: async () => initial.then(() => current),
    next: () => emitter.toPromise(simpleRx.event),
    filter: async (predicate: (state: T) => boolean) => {
      let state: T = await self.current()
      while (!predicate(state)) {
        // eslint-disable-next-line no-await-in-loop
        state = await self.next()
      }

      return state
    },
  }

  return self
}

simpleRx.event = 'state' as const
