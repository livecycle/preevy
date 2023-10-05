import fnv1a from '@sindresorhus/fnv1a'
import { ScriptInjectionSpecBase } from './model'

const scriptTag = (
  { src, async, defer }: ScriptInjectionSpecBase,
) => `<script ${[`src="${src}"`, async && 'async', defer && 'defer'].filter(Boolean).join(' ')}></script>`

export const injectedContentFromSpec = (injects: ScriptInjectionSpecBase[]) => {
  const scriptElements = injects.map(scriptTag).join('')
  return {
    scriptElements,
    etag: fnv1a(scriptElements, { size: 32 }).toString(36),
  }
}

export type InjectedContent = ReturnType<typeof injectedContentFromSpec>
