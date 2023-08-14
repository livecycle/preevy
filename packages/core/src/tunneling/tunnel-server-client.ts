import { BaseSshClient, SshClientOpts, baseSshClient, formatSshConnectionConfig, keyFingerprint, parseSshUrl } from '@preevy/common'
import { Logger } from '../log'
import { TunnelOpts } from '../ssh'
import { ProfileStore } from '../profile'

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
  client: Pick<BaseSshClient, 'execHello' | 'execTunnelUrl' | 'close'>
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
  clientPrivateKey,
  username,
  keysState,
  confirmHostFingerprint,
}: {
  log: Logger
  tunnelOpts: TunnelOpts
  clientPrivateKey: string | Buffer
  username: string
  keysState: ProfileStore['knownServerPublicKeys']
  confirmHostFingerprint: HostKeySignatureConfirmer
}): Promise<false | Connection> => {
  const parsed = parseSshUrl(tunnelOpts.url)

  const connectionConfigBase = {
    ...parsed,
    clientPrivateKey,
    username,
    tlsServerName: tunnelOpts.tlsServerName,
    insecureSkipVerify: tunnelOpts.insecureSkipVerify,
  }

  const attempt = async (): Promise<false | Connection> => {
    const knownServerPublicKeys = await keysState.read(parsed.hostname, parsed.port)
    const connectionConfig = { ...connectionConfigBase, knownServerPublicKeys }

    log.debug('connecting to tunnel server ssh with config', formatSshConnectionConfig(connectionConfig))

    const result = await connect({ log, connectionConfig })

    if ('hostKey' in result) {
      if (!knownServerPublicKeys.includes(result.hostKey)) { // TODO: check if this is correct
        await keysState.write(parsed.hostname, parsed.port, result.hostKey)
      }

      return result
    }

    if ('error' in result) {
      log.error('error checking connection', result.error)
      throw new Error(`Cannot connect to ${tunnelOpts.url}: ${result.error.message}`)
    }

    const confirmation = await confirmHostFingerprint({
      hostKeyFingerprint: keyFingerprint(result.unverifiedHostKey),
      hostname: parsed.hostname,
      port: parsed.port,
    })

    if (!confirmation) {
      return false
    }

    await keysState.write(parsed.hostname, parsed.port, result.unverifiedHostKey)

    return await attempt()
  }

  return await attempt()
}
