export type ScriptInjectionSpecBase = {
  src: string
  async?: boolean
  defer?: boolean
}

export type ScriptInjectionSpec = ScriptInjectionSpecBase & {
  pathRegex?: RegExp
}
