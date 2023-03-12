import path from 'path'
import fs from 'fs'
import yaml from 'yaml'
import { glob } from 'glob'

export const DIR = path.join(__dirname, '../static')
export const SCRIPT_DIR = path.join(DIR, 'scripts')

export const DOCKER_PROXY_DIR = path.dirname(require.resolve('@livecycle/docker-proxy'))
export const DOCKER_PROXY_COMPOSE_FILE = path.join(DOCKER_PROXY_DIR, 'docker-compose.yml')
export const readDockerProxyServiceName = async () => Object.keys(
  yaml.parse(await fs.promises.readFile(DOCKER_PROXY_COMPOSE_FILE, 'utf-8')).services
)[0]

export const dockerProxyFiles = async () => {
  const packageDir = path.dirname(require.resolve('@livecycle/docker-proxy'))
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8'))
  const packageJsonFiles = (await Promise.all(
    (packageJson.files as string[]).map(pattern => glob(pattern, { cwd: packageDir }))
  )).flat()

  return {
    dir: packageDir,
    files: ['package.json', packageJson.main, ...packageJsonFiles],
  }
}

export const DOCKER_PROXY_PORT = 3000
