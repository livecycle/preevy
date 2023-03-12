import path from 'path'

export const DIR = path.join(__dirname, '../static')
export const SCRIPT_DIR = path.join(DIR, 'scripts')

export const DOCKER_PROXY_DIR = path.join(path.dirname(require.resolve('@livecycle/docker-proxy')), '..')

export const DOCKER_PROXY_PORT = 3000
