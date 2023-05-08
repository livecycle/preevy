import { parseSshUrl, formatSshConnectionConfig, checkConnection, keyFingerprint } from '@preevy/common'
import { Logger } from '../../log'
import { ProfileStore } from '../profile'
import { generateSshKeyPair } from '../ssh/keypair'
import { TunnelOpts } from '../ssh/url'

export type Tunnel = {
  project: string
  service: string
  ports: Record<string, string[]>
}

export type FlatTunnel = {
  project: string
  service: string
  port: number
  url: string
}

export const flattenTunnels = (
  tunnels: Tunnel[],
): FlatTunnel[] => tunnels
  .map(t => Object.entries(t.ports).map(([port, urls]) => urls.map(url => ({ ...t, port: Number(port), url }))))
  .flat(2)

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
  ) => Promise<void>

export const performTunnelConnectionCheck = async ({
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
  }) => {
  const parsed = parseSshUrl(tunnelOpts.url)

  const connectionConfigBase = {
    ...parsed,
    clientPrivateKey,
    username,
    tlsServerName: tunnelOpts.tlsServerName,
    insecureSkipVerify: tunnelOpts.insecureSkipVerify,
  }

  const check = async (): Promise<{ hostKey: Buffer; clientId: string }> => {
    const knownServerPublicKeys = await keysState.read(parsed.hostname, parsed.port)
    const connectionConfig = { ...connectionConfigBase, knownServerPublicKeys }

    log.debug('connection check with config', formatSshConnectionConfig(connectionConfig))

    const result = await checkConnection({ log, connectionConfig })

    if ('clientId' in result) {
      if (!knownServerPublicKeys.includes(result.hostKey)) { // TODO: check if this is correct
        await keysState.write(parsed.hostname, parsed.port, result.hostKey)
      }
      return { hostKey: result.hostKey, clientId: result.clientId }
    }

    if ('error' in result) {
      log.error('error checking connection', result.error)
      throw new Error(`Cannot connect to ${tunnelOpts.url}: ${result.error.message}`)
    }

    await confirmHostFingerprint({
      hostKeyFingerprint: keyFingerprint(result.unverifiedHostKey),
      hostname: parsed.hostname,
      port: parsed.port,
    })

    await keysState.write(parsed.hostname, parsed.port, result.unverifiedHostKey)

    return check()
  }

  return check()
}

export const ensureTunnelKeyPair = async (
  { store, log }: {
      store: ProfileStore
      log: Logger
    },
) => {
  const existingKeyPair = await store.getTunnelingKey()
  if (existingKeyPair) {
    return existingKeyPair
  }
  log.info('Creating new SSH key pair')
  const keyPair = await generateSshKeyPair()
  await store.setTunnelingKey(Buffer.from(keyPair.privateKey))
  return keyPair
}
