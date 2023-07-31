import { KeyObject } from 'crypto'
import { IncomingMessage } from 'http'
import { calculateJwkThumbprintUri, exportJWK, jwtVerify } from 'jose'

export type Claims = {
    role: string
    exp?: number
}

function extractBasicAuth(req: IncomingMessage) {
  const { authorization } = req.headers
  const [scheme, data] = authorization?.split(' ') ?? []
  if (scheme !== 'Basic') {
    return undefined
  }
  const basicAuth = Buffer.from(data, 'base64').toString('ascii')
  const sep = basicAuth.indexOf(':')
  if (sep === -1) {
    return undefined
  }
  return [basicAuth.slice(0, sep), basicAuth.slice(sep + 1)]
}

export function tunnelingKeyAuthenticator(publicKey: KeyObject) {
  return async (req: IncomingMessage) => {
    const auth = extractBasicAuth(req)
    if (!auth) {
      return undefined
    }
    const [username, rawJWT] = auth
    if (username !== 'x-preevy-profile-key') {
      return undefined
    }
    const thumbprint = await calculateJwkThumbprintUri(await exportJWK(publicKey))
    const token = await jwtVerify(rawJWT, publicKey, { issuer: `preevy://${thumbprint}` })
    if (!token) {
      throw new Error('invalid token')
    }
    return { role: 'admin' }
  }
}

export function authenticator(authenticators: ((req: IncomingMessage)=> Promise<Claims | undefined>)[]) {
  return async (req: IncomingMessage) => {
    for (const authorizer of authenticators) {
      // eslint-disable-next-line no-await-in-loop
      const claims = await authorizer(req)
      if (claims) {
        return claims
      }
    }
    return undefined
  }
}
