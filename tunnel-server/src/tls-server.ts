import { Level, Logger } from 'pino'
import http from 'http'
import ssh from 'ssh2'
import tls from 'tls'

export const createTlsServer = ({ log, httpServer, sshServer, tlsConfig, sshHostnames }: {
  log: Logger<Level>
  httpServer: Pick<http.Server, 'emit'>
  sshServer: Pick<ssh.Server, 'injectSocket'>
  tlsConfig: tls.TlsOptions
  sshHostnames: string[]
}) => {
  log.info('SSH hostnames: %j', sshHostnames)
  const sshHostnamesSet = new Set(sshHostnames)

  return tls.createServer({ ...tlsConfig, ALPNProtocols: ['http/1.1', 'ssh'] })
    .on('error', err => { log.error(err) })
    .on('secureConnection', socket => {
      const { servername } = (socket as { servername?: string })
      log.debug('TLS connection: %j', servername)
      if ((servername && sshHostnamesSet.has(servername)) || socket.alpnProtocol === 'ssh') {
        sshServer.injectSocket(socket)
      } else {
        httpServer.emit('connection', socket)
      }
    })
}
