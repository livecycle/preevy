import {
  BaseSshClient, SshClientOpts, SshConnectionConfig, baseSshClient,
  formatSshConnectionConfig, keyFingerprint,
} from '@preevy/common'
import { Logger } from '../log.js'
import { TunnelOpts } from '../ssh/index.js'

export class UnverifiedHostKeyError extends Error {
  constructor(
    readonly tunnelOpts: TunnelOpts,
    readonly hostKeySignature: string,
  ) {
    super(`Host key verification failed for connection ${tunnelOpts.url}`)
    this.name = 'UnverifiedHostKeyError'
  }
}

export type HostKeySignatureConfirmer = (
  o: { hostKeyFingerprint: string; hostname: string; port: number | undefined }
) => Promise<boolean>

export type Connection = {
  client: Pick<BaseSshClient, 'execHello' | 'execTunnelUrl' | 'end'>
  hostKey: Buffer
}

type ConnectResult = Connection | {
  error: Error
} | {
  unverifiedHostKey: Buffer
}

const connect = ({
  log, connectionConfig,
}: Pick<SshClientOpts, 'log' | 'connectionConfig'>) => new Promise<ConnectResult>(resolve => {
  let hostKey: Buffer
  baseSshClient({
    log,
    connectionConfig,
    onHostKey: (key, verified) => {
      hostKey = key
      if (!verified) {
        resolve({ unverifiedHostKey: key })
      }
    },
  }).then(
    client => { resolve({ client, hostKey }) },
    err => resolve({ error: err }),
  )
})

export const connectToTunnelServerSsh = async ({
  log,
  tunnelOpts,
  connectionOpts,
  clientPrivateKey,
  username,
  knownServerPublicKeys,
  confirmHostFingerprint,
}: {
  log: Logger
  tunnelOpts: Pick<TunnelOpts, 'url' | 'tlsServerName' | 'insecureSkipVerify'>
  connectionOpts: Pick<SshConnectionConfig, 'hostname' | 'port' | 'isTls'>
  clientPrivateKey: string | Buffer
  username: string
  knownServerPublicKeys: readonly Buffer[]
  confirmHostFingerprint: HostKeySignatureConfirmer
}): Promise<false | Connection> => {
  const connectionConfigBase = {
    ...connectionOpts,
    clientPrivateKey,
    username,
    tlsServerName: tunnelOpts.tlsServerName,
    insecureSkipVerify: tunnelOpts.insecureSkipVerify,
  }

  const serverPublicKeysForThisConnection = [...knownServerPublicKeys]

  const attempt = async (): Promise<false | Connection> => {
    const connectionConfig = { ...connectionConfigBase, knownServerPublicKeys: serverPublicKeysForThisConnection }

    log.debug('connecting to tunnel server ssh with config', formatSshConnectionConfig(connectionConfig))

    const result = await connect({ log, connectionConfig })

    if ('hostKey' in result) {
      return result
    }

    if ('error' in result) {
      log.error('error checking connection', result.error)
      throw new Error(`Cannot connect to ${tunnelOpts.url}: ${result.error.message}`)
    }

    const confirmation = await confirmHostFingerprint({
      hostKeyFingerprint: keyFingerprint(result.unverifiedHostKey),
      hostname: connectionOpts.hostname,
      port: connectionOpts.port,
    })

    if (!confirmation) {
      return false
    }

    serverPublicKeysForThisConnection.push(result.unverifiedHostKey)

    return await attempt()
  }

  return await attempt()
}
