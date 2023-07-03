import crypto from 'crypto'
import { promisify } from 'util'
import { parseKey, parsePrivateKey } from 'sshpk'

export type SshKeyPair = {
  privateKey: Buffer | string
  publicKey: Buffer | string
}

const gen = promisify(crypto.generateKeyPair)

export const generateSshKeyPair = async (): Promise<{ privateKey: string; publicKey: string }> => {
  const { privateKey, publicKey } = await gen('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  return {
    privateKey: parsePrivateKey(privateKey).toString('ssh-private'),
    publicKey: parseKey(publicKey).toString('ssh'),
  }
}
export type SSHKeyConfig = SshKeyPair & { alias: string }
