import { IncomingMessage, ServerResponse } from 'http'
import { JWTPayload, JWTVerifyResult, jwtVerify, errors, decodeJwt } from 'jose'
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

type VerificationData = {
  pk: KeyObject
  extractClaims: (token: JWTPayload, thumbprint: string) => Claims
}

// export const SAAS_JWT_ISSUER = process.env.SAAS_JWT_ISSUER ?? 'app.livecycle.run'

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
  getVerificationData: (issuer: string, publicKeyThumbprint: string) => VerificationData
) => async (req: IncomingMessage): Promise<AuthenticationResult> => {
  const authHeader = extractAuthorizationHeader(req)
  const jwt = match(authHeader)
    .with({ scheme: 'Basic', username: 'x-preevy-profile-key' }, ({ password }) => password)
    .with({ scheme: 'Bearer' }, ({ token }) => token)
    .otherwise(() => new Cookies(req, undefined as unknown as ServerResponse<IncomingMessage>).get(cookieName))

  if (!jwt) {
    return { isAuthenticated: false }
  }

  const parsedJwt = decodeJwt(jwt)
  if (parsedJwt.iss === undefined) throw new AuthError('Could not find issuer in JWT')

  let verificationData: VerificationData
  try {
    verificationData = getVerificationData(parsedJwt.iss, publicKeyThumbprint)
  } catch (e) {
    if (e instanceof AuthError) return { isAuthenticated: false }

    throw e
  }

  const { pk, extractClaims } = verificationData

  let token: JWTVerifyResult
  try {
    token = await jwtVerify(jwt, pk,)
  } catch (e) {
    if (e instanceof errors.JOSEError) throw new AuthError(`Could not verify JWT. ${e.message}`, { cause: e })

    throw e
  }

  return {
    method: { type: 'header', header: 'authorization' },
    isAuthenticated: true,
    login: isBrowser(req) && authHeader?.scheme !== 'Bearer',
    claims: extractClaims(token.payload, publicKeyThumbprint),
  }
}

export const authenticator = (authenticators: ((req: IncomingMessage)=> Promise<AuthenticationResult>)[]) =>
  async (req: IncomingMessage):Promise<AuthenticationResult> => {
    const authInfos = (await Promise.all(authenticators.map(authn => authn(req))))
    const found = authInfos.find(info => info.isAuthenticated)
    if (found !== undefined) return found
    return { isAuthenticated: false }
  }

export const createGetVerificationData = (saasPublicKey: KeyObject, jwtSaasIssuer: string) => {
  const getSaasTokenVerificationData = (): VerificationData => ({
    pk: saasPublicKey,
    extractClaims: (token, thumbprint) => {
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
        role: parsedToken.profiles.includes(thumbprint) ? 'admin' : 'guest',
        type: 'profile',
        scopes: parsedToken.profiles.includes(thumbprint) ? ['admin'] : [],
      }
    },
  })

  const getCliTokenVerificationData = (pk: KeyObject,) =>
    (): VerificationData => ({
      pk,
      extractClaims: (token, thumbprint) => ({
        role: 'admin',
        type: 'profile',
        exp: token.exp,
        scopes: ['admin'],
        sub: `preevy-profile:${thumbprint}`,
      }),
    })

  const getCliIssuerFromPk = (publicKeyThumbprint: string) => `preevy://${publicKeyThumbprint}`

  return (publicKey: KeyObject) =>
    (issuer: string, publicKeyThumbprint: string) => {
      if (issuer === jwtSaasIssuer) {
        return getSaasTokenVerificationData()
      }

      if (issuer === getCliIssuerFromPk(publicKeyThumbprint)) {
        return getCliTokenVerificationData(publicKey)()
      }

      throw new AuthError(`Unsupported issuer ${issuer}`)
    }
}
