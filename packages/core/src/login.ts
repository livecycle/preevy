import fetch from 'node-fetch'
import { exec } from 'child_process'
import * as jose from 'jose'
import { VirtualFS, localFs } from './store'

export class TokenExpiredError extends Error {
  constructor() {
    super('Token is expired')
  }
}

const PERSISTENT_TOKEN_FILE_NAME = 'lc-access-token.json'

export type TokesFileSchema = {
  access_token: string
  id_token: string
}

const deviceFlow = async (dataDir: string, loginUrl: string) => {
  const fs = localFs(dataDir)
  // TODO: use this.config.dataDir to save the token for next CLI sessions
  const response = await fetch(`${loginUrl}/oauth/device/code?redirect_uri=https://www.google.com/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      client_id: 'jEnySAwuAaWaLOdWdALbvXj6dZEqgAJB',
      scope: 'email openid',
      audience: 'https://livecycle-preevy-cli/',
      redirect_uri: 'https://www.google.com/',
    }),
  })

  const responseData = (await response.json()) as {
          'device_code': string
          'user_code': string
          'verification_uri': string
          'expires_in': number
          'interval': number
          'verification_uri_complete': string
        }

  exec(`open ${responseData.verification_uri_complete}`) // TODO - use cross-platform, safer, opener once we get esm modules working
  console.log('make sure code is ', responseData.user_code)
  await new Promise<void>((resolve, reject) => {
    console.log('inside interval', responseData.expires_in)
    const intervalId = setInterval(async () => {
      try {
        console.log('before fetch')
        const tokenResponse = await fetch(`${loginUrl}/oauth/token`, { method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: responseData.device_code,
            client_id: 'jEnySAwuAaWaLOdWdALbvXj6dZEqgAJB' }) })
        console.log('response mother fucker', tokenResponse.status, tokenResponse.statusText)
        const tokenResponseData = await tokenResponse.json()
        if ('access_token' in tokenResponseData) {
          clearInterval(intervalId)
          const tokensFile: TokesFileSchema = {
            access_token: tokenResponseData.access_token,
            id_token: tokenResponseData.id_token,
          }
          await fs.write(PERSISTENT_TOKEN_FILE_NAME, JSON.stringify(tokensFile))
          console.log('got it!', tokenResponseData)
          resolve()
        }
      } catch (e) {
        console.log(e)
        reject(e)
      }
    }, responseData.interval * 1000)
    console.log('after set interval')
  })
}

export const getTokens = async (dataDir: string) : Promise<TokesFileSchema | undefined> => {
  const fs = localFs(dataDir)
  const tokensFile = await fs.read(PERSISTENT_TOKEN_FILE_NAME)
  if (tokensFile === undefined) return undefined

  const tokens: TokesFileSchema = JSON.parse(tokensFile.toString())
  const accessToken = jose.decodeJwt(tokens.access_token)
  if (accessToken.exp! < Math.floor(Date.now() / 1000)) {
    throw new TokenExpiredError()
  }
  return tokens
}

export const login = async (dataDir: string, loginUrl: string) => {
  try {
    const tokens = await getTokens(dataDir)
    if (tokens !== undefined) {
      console.log('already logged in: ', jose.decodeJwt(tokens.id_token).email)
    } else {
      await deviceFlow(dataDir, loginUrl)
    }
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      await deviceFlow(dataDir, loginUrl)
    } else {
      throw e
    }
  }
}
