export { SCRIPT_DIR as DIR } from '../../static'

export const CUSTOMIZE_BARE_MACHINE = [
  'install-docker.sh',
  'increase-open-files-limits.sh',
]

export const INSTANCE_SPECIFIC = [
  'tunnel-config.sh',
]

export const ALL = [...CUSTOMIZE_BARE_MACHINE, ...INSTANCE_SPECIFIC]
