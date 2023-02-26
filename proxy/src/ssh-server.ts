import crypto, { randomBytes } from 'crypto'
import { FastifyBaseLogger } from 'fastify/types/logger'
import fs from 'fs'
import net from 'net'
import path from 'path'
import ssh2, { utils as sshUtils } from 'ssh2'
import { Duplex, EventEmitter, Writable } from 'stream'

const HOST_KEY_FILENAME = path.resolve("./", process.env["SSH_HOST_KEY_FILE"] ?? './ssh/ssh_host_key')

const idFromPublicSsh = (key: Buffer) => crypto.createHash('sha1')
  .update(key)
  .digest('base64url')
  .replace(/[_-]/g, '')
  .slice(0, 6)
  .toLowerCase()

  
interface TunnelClient{
  clientId: string 
  on(event:"pipe-created", fn:(args:{tunnelName:string, socketPath: string})=>void):void
  on(event:"pipe-closed", fn:( args:{tunnelName:string, socketPath: string})=>void):void
  on(event:"shell", fn:(args: {stream:Duplex})=>void):void
  on(event:"exec", fn:(args: {command: string, stream: Writable})=>void):void
}

interface TunnelClientEmitter {
  emit(event: "pipe-created", args:{tunnelName: string, socketPath: string}):void
  emit(event: "pipe-closed", args: {tunnelName:string, socketPath: string}):void
  emit(event: "shell", args:{stream: Duplex}):void
  emit(event: "exec", args: {command: string, stream: Writable}):void
}


export const sshServer = ({ log, onClient }: {
  log: FastifyBaseLogger
  onClient?: (client: TunnelClient) => void
  //onPipeCreated?: (args: { socketPath: string, clientId: string }) => void
  //onPipeDestroyed?: (args: { socketPath: string, clientId: string }) => void
  //onClientShell?: (args: {clientId: string, stream: Duplex}) => void
}) => new ssh2.Server(
  {
    
    //debug: (x)=> log.debug(x),
    hostKeys: [fs.readFileSync(HOST_KEY_FILENAME)],
  },
  (client) => {
    log.debug('client connected!', client)
    let clientId: string
    let tunnels = 0
    const events = new EventEmitter();
    const emitter:TunnelClientEmitter = events

    client.on('authentication', (ctx) => {
      if (ctx.method !== 'publickey') {
        ctx.reject(["publickey"]);
        return
      }
      

      const keyOrError = sshUtils.parseKey(ctx.key.data)
      if (!('getPublicSSH' in keyOrError)) {
        log.error('error parsing key: %j', keyOrError)
        ctx.reject()
        return
      }

      // calling "accept" when no signature specified does not result in authenticated state
      // see: https://github.com/mscdex/ssh2/issues/561#issuecomment-303263753
      if (ctx.signature && !keyOrError.verify(ctx.blob as Buffer, ctx.signature)) {
        log.error('error verifying key: %j', keyOrError)
        ctx.reject(['publickey'])
        return
      }

      clientId = idFromPublicSsh(keyOrError.getPublicSSH())
      ctx.accept()
    })
    .on("ready", ()=> {
      onClient?.({
        clientId,
        on: events.on.bind(events)
      })
    })
    .on('request', (accept, reject, name, info) => {
      log.debug('request %j', { accept, reject, name, info })
      if (!client.authenticated) {
        log.error('not authenticated, rejecting')
        reject?.()
        return
      }

      if ((name as string) !== 'streamlocal-forward@openssh.com') {
        log.error('invalid request %j', { name, info })
        reject?.()
        return
      }

      const requestedSocketPath = (info as unknown as { socketPath: string }).socketPath
      const envName = requestedSocketPath.substring(1)

      const socketServer = net.createServer(socket => {
        log.debug('socketServer connected %j', socket)
        client.openssh_forwardOutStreamLocal(
          requestedSocketPath, // tell the client we're listening on the requested socket path, to prevent error messages
          (err, upstream) => {
            if (err) {
              log.error('error forwarding: %j', err)
              socket.end()
              socketServer.close((err)=> {
                log.error('error closing socket server: %j', err)
              })
              return
            }
            upstream.pipe(socket).pipe(upstream)
          },
        )
      })

      tunnels++

      const socketPath = `/tmp/s_${clientId}_${randomBytes(16).toString('hex')}`

      socketServer
        .listen(socketPath, () => {
          log.debug('calling accept: %j', accept)
          accept?.()
          emitter.emit('pipe-created', {tunnelName: envName, socketPath})
        })
        .on('error', (err: unknown) => {
          log.error('socketServer error', err)
          socketServer.close()
        })
        .on('close', () => {
          log.debug('socketServer close', socketPath)
          emitter.emit('pipe-closed',  {tunnelName: envName, socketPath})
        })

      client.once('close', () => {
        log.debug('client close, closing socketServer')
        socketServer.close()
        tunnels--
      })
    }).on('session', (accept, reject) => {
      log.debug('session')
      if (!tunnels) {
        return reject()
      }
      const session = accept();
      session.on("pty", (accept, reject, info) => {
        reject()
      })
      session.on("shell", (accept, reject) => {
        const shell = accept();
        
        const duplex = new Duplex({
          read(){
            if (!tunnels) {
              shell.stdout.exit(0)
              shell.stdout.end()
              return;
            }
            return shell.stdin.read()
          },
          write(chunk, encoding, callback){
            if (!tunnels) {
              shell.stdout.exit(0)
              shell.stdout.end()
              return;
            }
            return shell.stdout.write(chunk, encoding, callback)
          }
        })
        duplex.once('error', (err) => {
          log.error('error interacting with stream: %j', err)
        })
        emitter.emit("shell", {stream: duplex})
      })

      session.on('exec', (accept, reject, info) => {
        if (info.command !== "hello") {
          reject()
        }
        const stream = accept()
        const writable = new Writable({
          write(chunk, encoding, callback){
            if (!tunnels) {
              stream.exit(0)
              stream.end()
            }
            stream.stdout.write(chunk, encoding, callback)
          }
        })
        writable.once('error', (err) => {
          log.error('error writing to command stdout: %j', err)
        });

        emitter.emit("exec", {command: info.command,  stream: writable})
      })
    })
  },
)
