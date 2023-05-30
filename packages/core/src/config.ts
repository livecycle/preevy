export type PreevyPluginConfig = {
  module: string
  disabled?: boolean
  [key: string]: unknown
}

export type PreevyConfig = {
  plugins?: PreevyPluginConfig[]
}
