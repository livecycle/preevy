export type PreevyPluginConfig = {
  module: string
  disabled?: boolean
  [key: string]: unknown
}

export type PreevyConfig = {
  plugins?: PreevyPluginConfig[]
  driver?: string
  drivers?: Record<string, Record<string, unknown>>
}
