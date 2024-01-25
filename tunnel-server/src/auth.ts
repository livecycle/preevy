import { IncomingMessage, ServerResponse } from 'http'
import { JWTVerifyResult, jwtVerify, errors, decodeJwt, JWTPayload } from 'jose'
import { match } from 'ts-pattern'
import { ZodError, z } from 'zod'
import Cookies from 'cookies'
import { KeyObject } from 'crypto'

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
} | { isAuthenticated: false; reason?: string | Error }

export type Authenticator = (req: IncomingMessage)=> Promise<AuthenticationResult>

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
export type IdentityProvider = {
  issuer: string
  publicKey: KeyObject
  mapClaims: (issuer: JWTPayload, context: { pkThumbprint: string }) => Claims
}

const cookieName = 'preevy-saas-jwt'

export const saasJWTSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  profiles: z.array(z.string()),
  exp: z.number(),
  iat: z.number(),
})

type SaasJWTSchema = z.infer<typeof saasJWTSchema>

const isBrowser = (req: IncomingMessage) => {
  const userAgent = req.headers['user-agent']?.toLowerCase() ?? ''
  return /(chrome|firefox|safari|opera|msie|trident)/.test(userAgent)
}

const extractAuthorizationHeader = (req: IncomingMessage): AuthorizationHeader | undefined => {
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

export const jwtAuthenticator = (
  publicKeyThumbprint: string,
  identityProviders: IdentityProvider[],
) : Authenticator => async req => {
  const authHeader = extractAuthorizationHeader(req)
  const jwt = match(authHeader)
    .with({ scheme: 'Basic', username: 'x-preevy-profile-key' }, ({ password }) => password)
    .with({ scheme: 'Bearer' }, ({ token }) => token)
    .otherwise(() => new Cookies(req, undefined as unknown as ServerResponse<IncomingMessage>).get(cookieName))

  if (!jwt) {
    return { isAuthenticated: false, reason: 'no jwt in request' }
  }

  const parsedJwt = decodeJwt(jwt)
  if (parsedJwt.iss === undefined) throw new AuthError('Could not find issuer in JWT')

  const idp = identityProviders.find(x => x.issuer === parsedJwt.iss)
  if (!idp) {
    return { isAuthenticated: false, reason: `Could not find identity provider for issuer "${parsedJwt.iss}"` }
  }

  const { publicKey, mapClaims } = idp

  let token: JWTVerifyResult
  try {
    token = await jwtVerify(jwt, publicKey)
  } catch (e) {
    if (e instanceof errors.JOSEError) throw new AuthError(`Could not verify JWT. ${e.message}`, { cause: e })
    throw e
  }

  return {
    method: { type: 'header', header: 'authorization' },
    isAuthenticated: true,
    login: isBrowser(req) && authHeader?.scheme !== 'Bearer',
    claims: mapClaims(token.payload, { pkThumbprint: publicKeyThumbprint }),
  }
}

export const saasIdentityProvider = (sassIssuer:string, saasPublicKey: KeyObject): IdentityProvider => ({
  issuer: sassIssuer,
  publicKey: saasPublicKey,
  mapClaims: (token, { pkThumbprint: profile }) => {
    let parsedToken: SaasJWTSchema
    try {
      parsedToken = saasJWTSchema.parse(token)
    } catch (e) {
      if (e instanceof ZodError) {
        throw new AuthError(`JWT schema is incorrect. ${e.message}`, { cause: e })
      }
      throw e
    }

    return {
      exp: parsedToken.exp,
      iat: parsedToken.iat,
      sub: parsedToken.sub,
      role: parsedToken.profiles.includes(profile) ? 'admin' : 'guest',
      type: 'profile',
      scopes: parsedToken.profiles.includes(profile) ? ['admin'] : [],
    }
  },
})

export const cliIdentityProvider = (publicKey: KeyObject, publicKeyThumbprint:string): IdentityProvider => ({
  issuer: `preevy://${publicKeyThumbprint}`,
  publicKey,
  mapClaims: (token, { pkThumbprint: profile }) => ({
    role: 'admin',
    type: 'profile',
    exp: token.exp,
    scopes: ['admin'],
    sub: `preevy-profile:${profile}`,
  }),
})
