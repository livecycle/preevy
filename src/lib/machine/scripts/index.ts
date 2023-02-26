export const DIR = __dirname

export const FROM_BARE = [
  'install-docker.sh',
  'increase-open-files-limits.sh',
]

export const INSTANCE_SPECIFIC = [
  'tunnel-service.sh'
]

export const ALL = [...FROM_BARE, ...INSTANCE_SPECIFIC]
