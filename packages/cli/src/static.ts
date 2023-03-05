import path from 'path'
import { glob } from 'glob'

export const DIR = path.join(__dirname, '../static')
export const SCRIPT_DIR = path.join(DIR, 'scripts')

export const DOCKER_PROXY_DIR = path.dirname(require.resolve('@livecycle/docker-proxy'))
export const dockerProxyFiles = async () => {
  const packageDir = path.dirname(require.resolve('@livecycle/docker-proxy'))
  const packageJson = require(path.join(packageDir, 'package.json'))
  const packageJsonFiles = (await Promise.all(
    (packageJson.files as string[]).map(pattern => glob(pattern, { cwd: packageDir }))
  )).flat()
    
  return {
    dir: packageDir,
    files: ['package.json', packageJson.main, ...packageJsonFiles],
  }
}

export const DOCKER_PROXY_PORT = 3000
