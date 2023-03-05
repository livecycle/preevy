import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { isEqual } from "lodash-es"
import { RunningService } from "./docker.js"
import shellEscape from 'shell-escape'
import { TunnelNameResolver } from "./tunnel-name.js"
import { tryParseJson } from "./json.js"

type SshConnectionConfig = {
  hostname: string
  port: number
  isTls: boolean
}

export const parseSshUrl = (s: string): SshConnectionConfig => {
  const u = new URL(s)
  const isTls = Boolean(u.protocol.match(/(tls)|(https)/))
  return {
    hostname: u.hostname,
    port: Number(u.port || (isTls ? 443 : 22)),
    isTls,
  }
}

const calcSshArgs = ({ 
  config: { hostname, port, isTls }, 
  serverPublicKey,
  debug,
}: { config: SshConnectionConfig, serverPublicKey?: string, debug: boolean }) => {
  const args = [
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveCountMax=2',
    '-o', 'ServerAliveInterval=20',
    '-o', 'PubkeyAcceptedKeyTypes +ssh-rsa'
  ]

  const env: Record<string, string> = {}

  if (debug) {
    args.push('-v')
  }

  if (serverPublicKey) {
    env.SSH_SERVER_PUBLIC_KEY = serverPublicKey
    args.push('-o', `KnownHostsCommand /bin/sh -c 'echo [%h]:%p ssh-rsa $SSH_SERVER_PUBLIC_KEY'`)
  } else {
    console.warn('server public key not given, will not verify host key')
    args.push('-o', 'StrictHostKeyChecking=no')
  }

  if (isTls) {
    args.push('-o', `ProxyCommand openssl s_client -quiet -verify_quiet -servername ${process.env.TLS_SERVERNAME ?? '%h'} -connect %h:%p`)
  }

  args.push('-p', String(port))
  args.push(hostname)
  return { args, env }
}

const hasClientId = (
  o: unknown,
): o is { clientId: string } => Boolean(
  o && typeof o === 'object' && 'clientId' in o && typeof o.clientId === 'string'
)

const clientIdRe = /{\s*"clientId"\s*:\s*"([^"]+)"/
const extractClientId = (s: string) => s.match(clientIdRe)?.[1]

const sshClient = ({ serverPublicKey, sshUrl, debug, tunnelNameResolver, onError }: { 
  serverPublicKey?: string,
  sshUrl: string,
  debug: boolean
  tunnelNameResolver: TunnelNameResolver
  onError: (err: Error) => void
}) => {
  const connectionConfig = parseSshUrl(sshUrl)
  const { args: sshArgs, env } = calcSshArgs({ config: connectionConfig, serverPublicKey, debug })

  const startSsh = (
    services: RunningService[],
  ): Promise<{ sshProcess: ChildProcessWithoutNullStreams, clientId: string }> => {
    const routeParams = services.map(
      s => tunnelNameResolver(s).map(({ port, tunnel }) => ['-R', `/${tunnel}:${s.name}:${port}`])
    ).flat(2)

    const args = [
      '-nT',
      ...routeParams,
      ...sshArgs,
      'hello',
    ]

    console.log(`spawning: ssh ${shellEscape(args)}`)
    const sshProcess = spawn('ssh', args, { env: { ...process.env, ...env } })

    sshProcess.stderr.pipe(process.stderr)
    sshProcess.stdout.pipe(process.stdout)

    return new Promise((resolve, reject) => {
      sshProcess.on('exit', (code, signal) => {
        const message = `ssh process ${sshProcess.pid} exited with code ${code}${signal ? `and signal ${signal}` : ''}`
        if (!sshProcess.killed && code !== 0) {
          const err = new Error(message)
          reject(err)
          onError(err)
          return
        }
        console.debug(message)
      })

      // the "hello" response might be split between data chunks and prefixed or suffixed with other output
      let stdOutData = Buffer.from([])
      const clientIdGetter = (data: Buffer) => {
        stdOutData = Buffer.concat([stdOutData, data])
        const clientId = extractClientId(stdOutData.toString('utf-8'))
        if (clientId) {
          console.log('got clientId', clientId)
          stdOutData = Buffer.from([])
          sshProcess.removeListener('data', clientIdGetter)
          resolve({ sshProcess, clientId })
        }
      }

      sshProcess.stdout.on('data', clientIdGetter)

      console.log(`started ssh process ${sshProcess.pid}`)
    })
  }

  let currentSshProcess: ChildProcessWithoutNullStreams | undefined
  let currentServices: RunningService[] = []
  let clientId: string

  return {
    updateTunnels: async (services: RunningService[]): Promise<{ clientId: string }> => {
      if (currentSshProcess) {
        if (isEqual(services, currentServices)) {
          console.log('no changes, ignoring')
          return { clientId }
        }

        console.log(`killing current ssh process ${currentSshProcess.pid}`)
        currentSshProcess.kill()
      }

      currentServices = services
      const r = await startSsh(services)
      currentSshProcess = r.sshProcess
      clientId = r.clientId

      return { clientId }
    },
  }
}

export default sshClient
