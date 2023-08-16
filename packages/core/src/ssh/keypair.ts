import crypto from 'crypto'
import { promisify } from 'util'
import { parseKey, parsePrivateKey } from 'sshpk'

export type SshKeyPair = {
  privateKey: Buffer | string
  publicKey: Buffer | string
}

const gen = promisify(crypto.generateKeyPair)

const genRsa = () => gen('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const genEd25519 = () => gen('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

export type SshKeyPairType = 'rsa' | 'ed25519'

export const generateSshKeyPair = async (
  type: SshKeyPairType,
): Promise<{ privateKey: string; publicKey: string }> => {
  const { privateKey, publicKey } = await (type === 'rsa' ? genRsa() : genEd25519())

  return {
    privateKey: parsePrivateKey(privateKey).toString('ssh-private'),
    publicKey: parseKey(publicKey).toString('ssh'),
  }
}

export type SSHKeyConfig = SshKeyPair & { alias: string }
