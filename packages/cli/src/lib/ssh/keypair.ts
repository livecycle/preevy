import crypto from 'crypto'
import { promisify } from 'util'
import forge from 'node-forge'

export type SshKeyPair = {
  privateKey: Buffer | string
  publicKey: Buffer | string
}

export type NamedSshKeyPair = SshKeyPair & { name: string }

const gen = promisify(crypto.generateKeyPair)
const exportOpts = { type: 'pkcs1', format: 'pem' } as const

export const generateSshKeyPair = async (): Promise<{ privateKey: string; publicKey: string }> => {
  const { privateKey, publicKey } = await gen('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: exportOpts,
    privateKeyEncoding: exportOpts,
  })

  return {
    privateKey: forge.ssh.privateKeyToOpenSSH(forge.pki.privateKeyFromPem(privateKey)),
    publicKey: forge.ssh.publicKeyToOpenSSH(forge.pki.publicKeyFromPem(publicKey)),
  }
}
