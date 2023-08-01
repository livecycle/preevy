import { IncomingMessage, ServerResponse } from 'http'
import { JWTPayload, JWTVerifyResult, decodeJwt, jwtVerify, errors } from 'jose'
import { match } from 'ts-pattern'
import { z } from 'zod'
import Cookies from 'cookies'
import { KeyObject } from 'crypto'
import type { Logger } from 'pino'
import { PreviewEnv } from './preview-env'

export class AuthError extends Error {}

export const claimsSchema = z.object({
  role: z.string(),
  type: z.string(),
  scopes: z.array(z.string()),
  sub: z.string(),
  exp: z.number().optional(),
})

export type ClaimsSchema = typeof claimsSchema

export type Claims = z.infer<ClaimsSchema>

export type AuthenticationResult = {
  isAuthenticated: true
  login: boolean
  method: {
    type: 'header'
    header: 'authorization'
  }
  exp?: number
  claims: Claims
} | { isAuthenticated: false }

export type BasicAuthorizationHeader = {
  scheme: 'Basic'
  username: string
  password: string
}

export type BearerAuthorizationHeader = {
  scheme: 'Bearer'
  token: string
}

export type AuthorizationHeader = BasicAuthorizationHeader | BearerAuthorizationHeader

const cookieName = 'preevy-saas-jwt'

function extractAuthorizationHeader(req: IncomingMessage): AuthorizationHeader | undefined {
  const { authorization } = req.headers
  const [scheme, data] = authorization?.split(' ') ?? []
  if (scheme === 'Bearer') {
    return { scheme, token: data }
  }
  if (scheme === 'Basic') {
    const basicAuth = Buffer.from(data, 'base64').toString('ascii')
    const sep = basicAuth.indexOf(':')
    if (sep === -1) {
      return undefined
    }
    return { scheme, username: basicAuth.slice(0, sep), password: basicAuth.slice(sep + 1) }
  }
  return undefined
}

type IssuerToKeyData = (iss?: string) => {
  pk: KeyObject
  extractClaims: (token: JWTPayload) => Claims
}

const isBrowser = (req: IncomingMessage) => {
  const userAgent = req.headers['user-agent']?.toLowerCase() ?? ''
  return /(chrome|firefox|safari|opera|msie|trident)/.test(userAgent)
}

export function JwtAuthenticator(issuerToKeyData: IssuerToKeyData) {
  return async (req: IncomingMessage):Promise<AuthenticationResult> => {
    const auth = extractAuthorizationHeader(req)
    const jwt = match(auth)
      .with({ scheme: 'Basic', username: 'x-preevy-profile-key' }, ({ password }) => password)
      .with({ scheme: 'Bearer' }, ({ token }) => token)
      .otherwise(() => new Cookies(req, undefined as any).get(cookieName))

    if (!jwt) {
      return { isAuthenticated: false }
    }

    const { iss } = decodeJwt(jwt)
    const { pk, extractClaims } = issuerToKeyData(iss)
    let token: JWTVerifyResult
    try {
      token = await jwtVerify(jwt, pk, { issuer: iss })
    } catch (e) {
      if (e instanceof errors.JOSEError) throw new AuthError(`Could not verify JWT. ${e.message}`, { cause: e })

      throw e
    }

    return {
      method: { type: 'header', header: 'authorization' },
      isAuthenticated: true,
      login: isBrowser(req) && auth?.scheme !== 'Bearer',
      claims: extractClaims(token.payload),
    }
  }
}

export function authenticator(authenticators: ((req: IncomingMessage)=> Promise<AuthenticationResult>)[]) {
  return async (req: IncomingMessage):Promise<AuthenticationResult> => {
    const authInfos = (await Promise.all(authenticators.map(auth => auth(req))))
    const found = authInfos.find(info => info.isAuthenticated)
    if (found !== undefined) return found
    return { isAuthenticated: false }
  }
}

export const unauthorized = (res: ServerResponse<IncomingMessage>) => {
  res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"')
  res.statusCode = 401
  res.end('Unauthorized')
}

export const getIssuerToKeyDataFromEnv = (env: PreviewEnv, log: Logger): IssuerToKeyData => iss => {
  const expectedIssuer = `preevy://${env.publicKeyThumbprint}`
  if (iss !== expectedIssuer) {
    log.warn('Invalid issuer %j expected %s', iss, expectedIssuer)
    throw new AuthError('invalid issuer')
  }
  return {
    pk: env.publicKey,
    extractClaims: token => ({
      role: 'admin',
      type: 'profile',
      exp: token.exp,
      scopes: ['admin'],
      sub: `preevy-profile:${env.publicKeyThumbprint}`,
    }),
  }
}
