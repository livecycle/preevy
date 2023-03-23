export const overrideGetterSetter = <T extends {}, Prop extends keyof T>(
  o: T,
  prop: Prop,
  { getter, setter }: {
    getter?: (originalGetter: () => T[Prop]) => T[Prop]
    setter?: (v: T[Prop], originalSetter: (v: T[Prop]) => void) => void
  },
  p: unknown = o,
) => {
  const desc = Object.getOwnPropertyDescriptor(p, prop)
  if (!desc) {
    throw new Error(`${p} has no property ${String(prop)}`)
  }

  const { get: origGetter, set: origSetter } = desc

  if (getter && !origGetter) {
    throw new Error(`Cannot override getter: ${p} has no getter ${String(prop)}`)
  }

  if (setter && !origSetter) {
    throw new Error(`Cannot override setter: ${p} has no setter ${String(prop)}`)
  }

  Object.defineProperty(o, prop, {
    ...desc,
    get: getter ? () => getter.call(o, (origGetter as () => T[Prop]).bind(o)) : origGetter,
    set: setter ? (v: T[Prop]) => setter.call(o, v, (origSetter as (v: T[Prop]) => void).bind(o)) : origSetter,
  })

  return o
}
