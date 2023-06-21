import fetch from 'node-fetch'
import { exec } from 'child_process'
import * as jose from 'jose'
import { localFs } from './store'
import { Logger } from './log'
import { withSpinner } from './spinner'

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

const deviceFlow = async (dataDir: string, loginUrl: string, logger: Logger) => {
  const fs = localFs(dataDir)
  const response = await fetch(`${loginUrl}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      client_id: 'jEnySAwuAaWaLOdWdALbvXj6dZEqgAJB',
      scope: 'email openid profile',
      audience: 'https://livecycle-preevy-cli/',
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

  exec(`open ${responseData.verification_uri_complete}`) // TODO - use cross-platform, safer, opener - once we get esm modules working
  logger.info(`If your browser did not open, here: ${responseData.verification_uri_complete}`)
  logger.info('Make sure code is ', responseData.user_code)

  return withSpinner(() => new Promise<TokesFileSchema>((resolve, reject) => {
    const intervalId = setInterval(async () => {
      try {
        const tokenResponse = await fetch(`${loginUrl}/oauth/token`, { method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: responseData.device_code,
            client_id: 'jEnySAwuAaWaLOdWdALbvXj6dZEqgAJB' }) })

        if (!tokenResponse.ok && tokenResponse.status >= 500) throw new Error(`Bad response from token endpoint: ${tokenResponse.status}: ${tokenResponse.statusText}`)

        const tokenResponseData = await tokenResponse.json()
        if ('access_token' in tokenResponseData) {
          clearInterval(intervalId)
          const tokensFile: TokesFileSchema = {
            access_token: tokenResponseData.access_token,
            id_token: tokenResponseData.id_token,
          }
          await fs.write(PERSISTENT_TOKEN_FILE_NAME, JSON.stringify(tokensFile))

          resolve(tokenResponseData)
        }
      } catch (e) {
        logger.info('Error getting tokens', e)
        reject(e)
      }
    }, responseData.interval * 1000)
  }), { opPrefix: 'Waiting for approval', successText: 'Done!' })
}

export const getTokens = async (dataDir: string) : Promise<TokesFileSchema | undefined> => {
  const fs = localFs(dataDir)
  const tokensFile = await fs.read(PERSISTENT_TOKEN_FILE_NAME)
  if (tokensFile === undefined) return undefined

  const tokens: TokesFileSchema = JSON.parse(tokensFile.toString())
  const accessToken = jose.decodeJwt(tokens.access_token)
  if (accessToken.exp === undefined || (accessToken.exp < Math.floor(Date.now() / 1000))) {
    throw new TokenExpiredError()
  }
  return tokens
}

export const login = async (dataDir: string, loginUrl: string, lcUrl: string, logger: Logger) => {
  let tokens: TokesFileSchema
  try {
    const tokensMaybe = await getTokens(dataDir)
    if (tokensMaybe !== undefined) {
      logger.info(`Already logged in as: ${jose.decodeJwt(tokensMaybe.id_token).email} 👌`)
      return
    }
    tokens = await deviceFlow(dataDir, loginUrl, logger)
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      tokens = await deviceFlow(dataDir, loginUrl, logger)
    } else {
      throw e
    }
  }

  const response = await fetch(
    `${lcUrl}/post-login`,
    { method: 'POST',
      body: JSON.stringify({ id_token: tokens.id_token }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access_token}` } }
  )

  if (response.ok) {
    logger.info(`Logged in successfully as: ${jose.decodeJwt(tokens.id_token).email} 👌`)
  } else {
    throw new Error(`Bad response from post-login endpoint ${response.status}: ${response.statusText}`)
  }
}
