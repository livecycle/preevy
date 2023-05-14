import { inspect } from 'util'

type HasRequired<T, P extends keyof T> = Omit<T, P> & {
  [P2 in P]-?: NonNullable<T[P2]>;
}

const isPromiseLike = <T>(
  v: T | PromiseLike<T>,
): v is PromiseLike<T> => v && typeof (v as { then?: unknown }).then === 'function'

export function ensureDefined<T extends {}, Prop extends keyof T>(
  o: Promise<T>, ...props: Prop[]
): Promise<HasRequired<T, Prop>>
export function ensureDefined<T extends {}, Prop extends keyof T>(
  o: T, ...props: Prop[]
): HasRequired<T, Prop>
export function ensureDefined<T extends {}, Prop extends keyof T>(
  o: Promise<T> | T,
  ...props: Prop[]
): HasRequired<T, Prop> | Promise<HasRequired<T, Prop>> {
  const f = (obj: T) => {
    for (const prop of props) {
      if (obj[prop] === undefined || obj[prop] === null) {
        throw new Error(`${String(prop)} not found in ${inspect(obj)}`)
      }
    }
    return obj as unknown as HasRequired<T, Prop>
  }
  return isPromiseLike(o) ? o.then(f) : f(o)
}

export function extractDefined<T extends {}, Prop extends keyof T>(
  o: Promise<T>, prop: Prop
): Promise<NonNullable<T[Prop]>>
export function extractDefined<T extends {}, Prop extends keyof T>(
  o: T, prop: Prop
): NonNullable<T[Prop]>
export function extractDefined<T extends {}, Prop extends keyof T>(
  o: Promise<T> | T,
  prop: Prop,
): NonNullable<T[Prop]> | Promise<NonNullable<T[Prop]>> {
  const defined = ensureDefined(o as Promise<T>, prop)
  return isPromiseLike(o)
    ? defined.then(obj => obj[prop] as unknown as NonNullable<T[Prop]>)
    : (o as T)[prop] as NonNullable<T[Prop]>
}
