import ssh2, { ParsedKey } from 'ssh2'
import { inspect } from 'util'
import { createHash } from 'crypto'

export const parseKey = (...args: Parameters<typeof ssh2.utils.parseKey>): ParsedKey => {
  const parsedKey = ssh2.utils.parseKey(...args)
  if (!('verify' in parsedKey)) {
    throw new Error(`Could not parse key: ${inspect(parsedKey)}`)
  }
  return parsedKey
}

export const formatPublicKey = (...args: Parameters<typeof ssh2.utils.parseKey>) => {
  const parsed = parseKey(...args)
  return `${parsed.type} ${parsed.getPublicSSH().toString('base64')}`
}

export const keyFingerprint = (
  key: Buffer,
) => `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`
