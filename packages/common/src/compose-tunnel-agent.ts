export const COMPOSE_TUNNEL_AGENT_SERVICE_LABELS = {
  PROFILE_THUMBPRINT: 'preevy.profile_thumbprint',
  PRIVATE_MODE: 'preevy.private_mode',
  ENV_ID: 'preevy.env_id',
  ACCESS: 'preevy.access',
  EXPOSE: 'preevy.expose',
  INJECT_SCRIPT_SRC: 'preevy.inject_script_src',
  INJECT_SCRIPTS: 'preevy.inject_scripts',
  INJECT_SCRIPT_PATH_REGEX: 'preevy.inject_script_path_regex',
}

export const COMPOSE_TUNNEL_AGENT_SERVICE_NAME = 'preevy_proxy'
export const COMPOSE_TUNNEL_AGENT_PORT = 3000

export type ScriptInjection = {
  pathRegex?: RegExp
  src: string
  defer?: boolean
  async?: boolean
}
