import Docker from 'dockerode'
import createDockerClient, { RunningService } from './src/docker.js'
import createWebServer from './src/web.js'
import createSshClient, { tunnelNames } from './src/ssh.js'
import { requiredEnv } from './src/env.js'

type TunnelsResponse = Record<string, Record<string, Record<number, string>>>

const main = async () => {
  const docker = new Docker({ socketPath: '/var/run/docker.sock' })
  const dockerClient = createDockerClient({ docker, debounceWait: 500 })
  let clientId: string | undefined
  const sshClient = createSshClient({
    onClientId: clId => { clientId = clId },
    sshUrl: requiredEnv('SSH_URL'),
    serverPublicKey: process.env.SSH_SERVER_PUBLIC_KEY,
    debug: Boolean(process.env.DEBUG),
  })

  let services: RunningService[] = []
  dockerClient.listenToContainers({ 
    onChange: updatedServices => {
      services = updatedServices
      sshClient.updateTunnels(services)
    },
  })

  const webServer = createWebServer({
    getTunnels: async (): Promise<unknown> => ({
      projects: services.reduce((acc: TunnelsResponse, s) => ({
        ...acc,
        [s.project]: {
          ...acc[s.project],
          [s.name]: Object.fromEntries(
            tunnelNames(s).map(({ name, port }) => [port, name])
          ),
        },
      }) as TunnelsResponse, {}),
      services: services.map(s => ({
        project: s.project,
        service: s.name,
        ports: tunnelNames(s),
      })),
      tunnels: services.flatMap(s => tunnelNames(s).map(({ name }) => name)),
    }),
    getClientId: async (): Promise<string | undefined> => clientId, 
  })

  const port = process.env.PORT ?? 3000;
  webServer.listen(port, () => {
    console.log(`listening on port ${port}`)
  })
  webServer.on('error', (err) => {
    console.error(err)
    process.exit(1)
  })
  webServer.unref()
}

main()
