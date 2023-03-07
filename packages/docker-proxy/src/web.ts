import http from 'node:http'
import { SshState } from './ssh/index.js'

const createWebServer = ({
  getSshState,
}: {
  getSshState: () => Promise<SshState>
}) => {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/tunnels') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await getSshState()))
      return
    }

    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('OK')
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })

  return server
}

export default createWebServer
