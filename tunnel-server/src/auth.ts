import { IncomingMessage } from 'http'
import { JWTPayload, calculateJwkThumbprintUri, decodeJwt, exportJWK, jwtVerify } from 'jose'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { PreviewEnv } from './preview-env'
import Cookies from 'cookies'

export type AuthenticationResult = {
  isAuthenticated: true
  login: boolean
  exp?: number
  claims: Claims
} | { isAuthenticated: false }

export const claimsSchema = z.object({
  role: z.string(),
  type: z.string(),
  scopes: z.array(z.string()),
  sub: z.string(),
  exp: z.number().optional()
})

export type ClaimsSchema = typeof claimsSchema

export type Claims = z.infer<ClaimsSchema>

export type AuthorizationHeader = BasicAuthorizationHeader | BearerAuthorizationHeader

export type BasicAuthorizationHeader = {
  scheme: 'Basic'
  username: string
  password: string
}

export type BearerAuthorizationHeader = {
  scheme: 'Bearer'
  token: string
}

const cookieName = 'preevy-sass-jwt'

function extractAuthorizationHeader(req: IncomingMessage): AuthorizationHeader | undefined {
  const authorization = req.headers['authorization'];
  const [scheme, data] = authorization?.split(' ') ?? []
  if (scheme === 'Bearer') {
    return { scheme, token: data }
  }
  if (scheme === 'Basic') {
    const basicAuth = Buffer.from(data, 'base64').toString('ascii');
    const sep = basicAuth.indexOf(":")
    if (sep === -1){
      return undefined
    }
    return {scheme, username: basicAuth.slice(0,sep), password: basicAuth.slice(sep+1)};
  }
  return undefined
}

export function JwtAuthenticator(env: PreviewEnv){
  return async (req: IncomingMessage):Promise<AuthenticationResult>=>{
    const auth = extractAuthorizationHeader(req);
    const jwt = match(auth)
      .with({scheme: 'Basic', username: 'x-preevy-profile-key'}, ({password:jwt}) => jwt)
      .with({scheme: 'Bearer'}, ({token:jwt}) => jwt)
      .otherwise(() => new Cookies(req, undefined as any).get(cookieName))

    if (!jwt){
      return {isAuthenticated: false}
    }

    const { iss } = decodeJwt(jwt)
    const { issuer, publicKey, extractClaims } = await match(iss).when(
     ()=>iss?.startsWith('preevy://'), async () => {
        const thumbprint = await calculateJwkThumbprintUri(await exportJWK(env.publicKey))
        return {
          publicKey: env.publicKey,
          issuer: `preevy://${thumbprint}`,
          extractClaims: (token:JWTPayload)=>({
            role: 'admin',
            type: 'profile',
            exp: token.exp,
            scopes: ['admin'],
            sub: `preevy-profile:${env.publicKeyThumbprint}`
          })
        }
      }).otherwise(async ()=>{
        throw new Error("invalid issuer")
      })

    const token = await jwtVerify(jwt, publicKey, {issuer: issuer})
    if (!token) {
      throw new Error("invalid token");
    }
    return {
      isAuthenticated: true,
      login: auth?.scheme !== 'Bearer',
      claims: extractClaims(token.payload)
    }
  }
}

export function authenticator(authenticators: ((req: IncomingMessage)=> Promise<AuthenticationResult>)[] ){
  return async (req: IncomingMessage):Promise<AuthenticationResult> =>{
    for (const authorizer of authenticators){
      const authInfo = await authorizer(req)
      if (authInfo.isAuthenticated){
        return authInfo
      }
    }
    return {isAuthenticated: false};
  }
}