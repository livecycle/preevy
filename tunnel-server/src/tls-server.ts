import { Logger } from 'pino'
import http from 'http'
import ssh from 'ssh2'
import tls from 'tls'

export const createTlsServer = ({ log, httpServer, sshServer, tlsConfig, sshHostnames }: {
  log: Logger
  httpServer: Pick<http.Server, 'emit'>
  sshServer: Pick<ssh.Server, 'injectSocket'>
  tlsConfig: tls.TlsOptions
  sshHostnames: Set<string>
}) => tls.createServer(tlsConfig)
  .on('error', err => { log.error(err) })
  .on('secureConnection', socket => {
    const { servername } = (socket as { servername?: string })
    log.debug('TLS connection: %j', servername)
    if (servername && sshHostnames.has(servername)) {
      sshServer.injectSocket(socket)
    } else {
      httpServer.emit('connection', socket)
    }
  })
