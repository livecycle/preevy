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

export type SimpleEmitter<T extends Record<string, unknown>> = ReturnType<typeof simpleEmitter<T>>
export type EmitterConsumer<T extends Record<string, unknown>> = Omit<SimpleEmitter<T>, 'emit'>
