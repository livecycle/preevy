import { HostKeySignatureConfirmer, Logger, ProfileStore, performTunnelConnectionCheck } from '@preevy/core'
import { TunnelOpts } from '@preevy/core/src/ssh'
import os from 'os'
import { carefulBooleanPrompt } from './prompt'

const confirmHostFingerprint = async (
  { hostKeyFingerprint: hostKeySignature, hostname, port }: Parameters<HostKeySignatureConfirmer>[0],
) => {
  const formattedHost = port ? `${hostname}:${port}` : hostname
  const message = [
    `The authenticity of host '${formattedHost}' can't be established.`,
    `Key fingerprint is ${hostKeySignature}`,
    'Are you sure you want to continue connecting (yes/no)?',
  ].join(os.EOL)
  return carefulBooleanPrompt(message)
}

export const tunnelServerHello = async ({ log, tunnelOpts, tunnelingKey, keysState }: {
  log: Logger
  tunnelOpts: TunnelOpts
  tunnelingKey: string
  keysState: ProfileStore['knownServerPublicKeys']
}) => performTunnelConnectionCheck({
  log,
  tunnelOpts,
  clientPrivateKey: tunnelingKey,
  username: process.env.USER || 'preview',
  confirmHostFingerprint,
  keysState,
})
