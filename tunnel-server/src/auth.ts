import { IncomingMessage, ServerResponse } from 'http'
import { JWTPayload, JWTVerifyResult, jwtVerify, errors, decodeJwt } from 'jose'
import { match } from 'ts-pattern'
import { ZodError, z } from 'zod'
import Cookies from 'cookies'
import { KeyObject, createPublicKey } from 'crypto'
import fs from 'fs'
import path from 'path'
import { PreviewEnv } from './preview-env'
import { HttpError } from './http-server-helpers'

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

type VerificationData = {
  pk: KeyObject
  extractClaims: (token: JWTPayload, thumbprint: string) => Claims
}

const isBrowser = (req: IncomingMessage) => {
  const userAgent = req.headers['user-agent']?.toLowerCase() ?? ''
  return /(chrome|firefox|safari|opera|msie|trident)/.test(userAgent)
}

export const jwtAuthenticator = (
  publicKeyThumbprint: string,
  getVerificationData: (issuer: string, publicKeyThumbprint: string) => VerificationData
) => async (req: IncomingMessage): Promise<AuthenticationResult> => {
  const auth = extractAuthorizationHeader(req)
  const jwt = match(auth)
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
    login: isBrowser(req) && auth?.scheme !== 'Bearer',
    claims: extractClaims(token.payload, publicKeyThumbprint),
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

// TODO: combine with UnauthorizedError
export const basicAuthUnauthorized = (res: ServerResponse<IncomingMessage>) => {
  res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"')
  res.statusCode = 401
  res.end('Unauthorized')
}

const SAAS_PUBLIC_KEY = process.env.SAAS_PUBLIC_KEY || fs.readFileSync(
  path.join('/', 'etc', 'certs', 'preview-proxy', 'saas.key.pub'),
  { encoding: 'utf8' },
)

const publicKey = createPublicKey(SAAS_PUBLIC_KEY)

export const SAAS_JWT_ISSUER = process.env.SAAS_JWT_ISSUER ?? 'app.livecycle.run'

export const getCLIIssuerFromPK = (publicKeyThumbprint: string) => `preevy://${publicKeyThumbprint}`

const getCLITokenVerificationData = (pk: KeyObject,) =>
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

export const saasJWTSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  profiles: z.array(z.string()),
  exp: z.number(),
  iat: z.number(),
})

type SaasJWTSchema = z.infer<typeof saasJWTSchema>

export class UnauthorizedError extends HttpError {
  static status = 401
  static defaultMessage = 'Unauthorized'
  constructor(readonly reason: string) {
    super(UnauthorizedError.status, UnauthorizedError.defaultMessage, undefined, {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    })
  }
}
const getSaasTokenVerificationData = (): VerificationData => ({
  pk: publicKey,
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

export const getCombinedCLIAndSAASVerificationData = (env: PreviewEnv) =>
  (issuer: string, publicKeyThumbprint: string) => {
    if (issuer === SAAS_JWT_ISSUER) {
      return getSaasTokenVerificationData()
    }

    if (issuer === getCLIIssuerFromPK(publicKeyThumbprint)) {
      return getCLITokenVerificationData(env.publicKey)()
    }

    throw new AuthError(`Unsupported issuer ${issuer}`)
  }
