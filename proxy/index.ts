import { promisify } from 'util'
import { app as createApp } from './src/app'
import { numberFromEnv } from './src/env'
import { inMemoryPreviewEnvStore } from './src/preview-env'
import { sshServer as createSshServer } from './src/ssh-server'

const PORT = numberFromEnv('PORT') || 3000
const SSH_PORT = numberFromEnv('SSH_PORT') || 2222
const LISTEN_HOST = '0.0.0.0'
const DOMAIN = process.env['DOMAIN'] || 'local.livecycle.run'
const TUNNEL_SCHEME = process.env['TUNNEL_SCHEME'] || 'https'
const TUNNEL_PORT = process.env['TUNNEL_PORT'] || '443'

const envStore = inMemoryPreviewEnvStore({
  test: {
    serviceHostSuffix: '-app',
    target: 'http://3.73.126.120',
  },
})

function getTunnelUrl(tunnelPrefix: string){
  const portSuffix = (TUNNEL_SCHEME==="https" && TUNNEL_PORT === '443') || (TUNNEL_SCHEME==="http" && TUNNEL_PORT === '80') ? '' : `:${TUNNEL_PORT}`
  return `${TUNNEL_SCHEME}://${tunnelPrefix}.${DOMAIN}${portSuffix}`
}

const app = createApp({ envStore })
const sshLogger = app.log.child({ component: 'ssh_server' })

const sshServer = createSshServer({
  log: sshLogger,
  onClient: (client)=>{
    const {clientId} = client
    const envs = new Set<string>();
    client.on("pipe-created", async ({tunnelName, socketPath})=> {
      sshLogger.info(`machine connected: %j`, { clientId, socketPath })
      const envName  = `${tunnelName}-${clientId}`
      envs.add(envName)
      await envStore.set(envName, { serviceHostSuffix: '-app', target: socketPath })
    })

    client.on("pipe-closed", async ({tunnelName, socketPath})=> {
      sshLogger.info(`machine connected: %j`, { clientId, socketPath })
      const envName  = `${tunnelName}-${clientId}`
      envs.delete(envName)
      await envStore.set(envName, { serviceHostSuffix: '-app', target: socketPath })
    })

    client.on("shell", ({stream}) => {
      stream.write(`connected to ${clientId} (${envs.size} tunnels) \n`)
      stream.write(`${[...envs].map((l)=>getTunnelUrl(l)).join('\n')}\n`)
    });

    client.on("exec", ({command, stream}) => {
      if (command === "hello"){
        for (const l of envs){
          stream.write(`${JSON.stringify({ id: l })}\n`)
        }
      }
    });
    
    return;
  }
}).listen(SSH_PORT, LISTEN_HOST, () => {
  app.log.debug('ssh server listening on port %j', SSH_PORT)
}).on('error', (err: unknown) => {
  app.log.error('ssh server error: %j', err)
})

app.listen({ host: LISTEN_HOST, port: PORT }).catch(err => {
  app.log.error(err)
  process.exit(1)
})

;['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.once(signal, () => {
    app.log.info(`shutting down on ${signal}`)
    Promise.all([promisify(sshServer.close).call(sshServer),app.close()])
    .catch((err) => {
      app.log.error(err)
      process.exit(1)
    }).finally(()=> {
      process.exit(0)
    })
  })
})