import { JWTPayload, calculateJwkThumbprintUri, exportJWK, SignJWT } from 'jose'
import ssh2 from 'ssh2'
import { Buffer } from 'buffer'
import { KeyObject, createPrivateKey } from 'crypto'
import memoize from 'p-memoize'

function getAsymmetricKeyAlg(key: KeyObject) {
  if (!key.asymmetricKeyType) {
    throw new Error('Only asymmetric keys are supported')
  }
  switch (key.asymmetricKeyType) {
    case 'rsa':
      return 'RS256'
    case 'ed25519':
      return 'EdDSA'
    default:
      throw new Error('Only RSA and Ed25519 keys are supported')
  }
}

export const jwtGenerator = (privateKey: string | Buffer) => {
  const sshKey = ssh2.utils.parseKey(privateKey)
  if (sshKey instanceof Error) {
    throw new Error('Could not parse private key', { cause: sshKey })
  }
  const key = createPrivateKey(sshKey.getPrivatePEM())
  const alg = getAsymmetricKeyAlg(key)
  const thumbprint = memoize(async () => await calculateJwkThumbprintUri(await exportJWK(key)))

  return async ({ claims = {}, exp = '60d' }: {claims?:JWTPayload; exp?: string} = {}) => await (new SignJWT(claims).setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(`preevy://${await thumbprint()}`)
    .setExpirationTime(exp)
    .sign(key))
}

export type JwtGenerator = ReturnType<typeof jwtGenerator>

export const generateBasicAuthCredentials = async (jwtGen: JwtGenerator) => ({
  user: 'x-preevy-profile-key',
  password: await jwtGen(),
})
