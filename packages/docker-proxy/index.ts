import fs from 'fs'
import path from 'path'
import Docker from 'dockerode'
import { inspect } from 'node:util'
import createDockerClient, { RunningService } from './src/docker.js'
import createWebServer from './src/web.js'
import createSshClient, { SshState } from './src/ssh.js'
import { requiredEnv } from './src/env.js'
import { tunnelNameResolver } from './src/tunnel-name.js'

const main = async () => {
  const docker = new Docker({ socketPath: '/var/run/docker.sock' })
  const dockerClient = createDockerClient({ docker, debounceWait: 500 })

  const sshClient = await createSshClient({
    onError: err => {
      console.error(err)
      process.exit(1)
    },
    username: process.env.USER ?? 'foo',
    clientPrivateKey: fs.readFileSync(path.join(process.env.HOME || '/root', '.ssh', 'id_rsa'), { encoding: 'utf8' }),
    tunnelNameResolver,
    sshUrl: requiredEnv('SSH_URL'),
    serverPublicKey: process.env.SSH_SERVER_PUBLIC_KEY,
  })

  let services: RunningService[]
  let state: SshState

  const initPromise = new Promise<void>(resolve => {
    void dockerClient.listenToContainers({
      onChange: async updatedServices => {
        services = updatedServices
        state = await sshClient.updateTunnels(services)
        resolve()
      },
    })
  })

  const webServer = createWebServer({
    getSshState: () => initPromise.then(() => state),
  })
    .listen(process.env.PORT ?? 3000, () => {
      console.log(`listening on ${inspect(webServer.address())}`)
    })
    .on('error', err => {
      console.error(err)
      process.exit(1)
    })
    .unref()
}

void main()
