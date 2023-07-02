import { JWTPayload, calculateJwkThumbprintUri, exportJWK, SignJWT } from 'jose'
import { KeyObject, createPrivateKey } from 'crypto'

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
  const key = createPrivateKey(privateKey)
  if (!key.asymmetricKeyType) {
    throw new Error('Only asymmetric keys are supported')
  }
  const alg = getAsymmetricKeyAlg(key)
  const thumbprint = (async () => await calculateJwkThumbprintUri(await exportJWK(key)))() // better to use memoize
  return async ({ claims = {}, exp = '60d' }: {claims?:JWTPayload; exp?: string} = {}) => await (new SignJWT(claims).setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(`preevy://${await thumbprint}`)
    .setExpirationTime(exp)
    .sign(key))
}

export type JwtGenerator = ReturnType<typeof jwtGenerator>

export const getUserCredentials = async (jwtGen: JwtGenerator) => {
  const user = 'x-preevy-profile-key'

  return {
    user,
    password: await jwtGen(),
  }
}

export const addBasicAuthCredentials = (url: string, user: string, password: string) => {
  const parsed = new URL(url)
  parsed.username = user
  parsed.password = password
  return parsed.toString()
}
