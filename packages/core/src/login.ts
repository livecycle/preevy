
import * as jose from 'jose'
import { z } from 'zod'
import open from 'open'
import * as inquirer from '@inquirer/prompts'
import { inspect } from 'util'
import { VirtualFS, localFs } from './store/index.js'
import { Logger } from './log.js'
import { withSpinner } from './spinner.js'

export class TokenExpiredError extends Error {
  constructor() {
    super('Token is expired')
  }
}

type PostLoginResult = { userId: string; currentOrg: string; currentOrgRole: string; email: string } |
  {
    userId: string
    email: string
    organizationDomainDetails: {
      name: string
      isOrganizationalDomain: true
      domain: string
    }
  }

const PERSISTENT_TOKEN_FILE_NAME = 'lc-access-token.json'

const wait = (timeInMs: number) => new Promise<void>(resolve => {
  setTimeout(() => {
    resolve()
  }, timeInMs)
})

const tokensResponseDataSchema = z.object({
  access_token: z.string(),
  id_token: z.string(),
})

export type TokenFileSchema = z.infer<typeof tokensResponseDataSchema>

const pollTokensFromAuthEndpoint = async (
  loginUrl: string,
  deviceCode: string,
  logger: Logger,
  interval: number,
  clientId: string
) => {
  try {
    while (true) {
      const tokenResponse = await fetch(`${loginUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
          client_id: clientId,
        }),
      })

      if (tokenResponse.status !== 403) {
        if (!tokenResponse.ok) throw new Error(`Bad response from token endpoint: ${tokenResponse.status}: ${tokenResponse.statusText}`)

        return tokensResponseDataSchema.parse(await tokenResponse.json())
      }

      await wait(interval)
    }
  } catch (e) {
    logger.info('Error getting tokens', e)
    throw e
  }
}

const deviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  expires_in: z.number(),
  interval: z.number(),
  verification_uri_complete: z.string(),
})

const deviceFlow = async (loginUrl: string, logger: Logger, clientId: string) => {
  const deviceCodeResponse = await fetch(`${loginUrl}/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      client_id: clientId,
      scope: 'email openid profile',
      audience: 'https://livecycle-preevy-saas',
    }),
  })

  const responseJson = await deviceCodeResponse.json()
  const response = await deviceCodeSchema.safeParseAsync(responseJson)
  if (!response.success) {
    throw new Error(`Error parsing device code response: ${response.error}:\n${inspect(responseJson, { depth: null })}`)
  }
  const responseData = response.data
  logger.info('Opening browser for authentication')
  try {
    await open(responseData.verification_uri_complete)
  } catch (e) {
    logger.info(`Could not open browser at ${responseData.verification_uri_complete}`)
    logger.info('Please try entering the URL manually')
  }
  logger.info('Make sure code is ', responseData.user_code)
  return await withSpinner(
    () => pollTokensFromAuthEndpoint(
      loginUrl,
      responseData.device_code,

      logger,

      responseData.interval * 1000,
      clientId
    ),
    {
      opPrefix: 'Waiting for approval',
      successText: 'Done!',
    }
  )
}

export const getTokensFromLocalFs = async (fs: VirtualFS): Promise<TokenFileSchema | undefined> => {
  const tokensFile = await fs.read(PERSISTENT_TOKEN_FILE_NAME)
  if (tokensFile === undefined) return undefined

  const tokens: TokenFileSchema = JSON.parse(tokensFile.toString())
  const accessToken = jose.decodeJwt(tokens.access_token)
  if (accessToken.exp === undefined || (accessToken.exp < Math.floor(Date.now() / 1000))) {
    throw new TokenExpiredError()
  }
  return tokens
}

export const login = async (dataDir: string, loginUrl: string, lcUrl: string, clientId: string, logger: Logger) => {
  const fs = localFs(dataDir)
  let tokens: TokenFileSchema
  try {
    const tokensMaybe = await getTokensFromLocalFs(fs)
    if (tokensMaybe !== undefined) {
      logger.info(`Already logged in as: ${jose.decodeJwt(tokensMaybe.id_token).email} 👌`)
      return
    }
    tokens = await deviceFlow(loginUrl, logger, clientId)
  } catch (e) {
    if (!(e instanceof TokenExpiredError)) {
      throw e
    }

    tokens = await deviceFlow(loginUrl, logger, clientId)
  }

  await fs.write(PERSISTENT_TOKEN_FILE_NAME, JSON.stringify(tokens))

  const postLoginResponse = await fetch(
    `${lcUrl}/api/cli/post-login`,
    {
      method: 'POST',
      body: JSON.stringify({ id_token: tokens.id_token }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }
  )

  if (postLoginResponse.ok) {
    const postLoginData = await postLoginResponse.json() as PostLoginResult
    if (!('currentOrg' in postLoginData)) {
      const orgName = await inquirer.input({
        message: 'Select a name for your organization',
        default: postLoginData.organizationDomainDetails.name,
      })
      const associateDomain = await inquirer.confirm({
        message: `Allow anyone with @${postLoginData.organizationDomainDetails.domain} email domain to join your organization as viewers`,
        default: true,
      })

      const createOrganizationResponse = await withSpinner(
        () => fetch(
          `${lcUrl}/api/org`,
          {
            method: 'POST',
            body: JSON.stringify({
              name: orgName,
              associateDomain,
            }),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        ),
        {
          opPrefix: 'Creating organization',
          successText: 'Done!',
        }
      )

      if (!createOrganizationResponse.ok) {
        throw new Error(`Bad response from org endpoint ${createOrganizationResponse.status}: ${createOrganizationResponse.statusText}`)
      }
      logger.info(`Logged in successfully as: ${jose.decodeJwt(tokens.id_token).email} 👌`)
    }
  } else {
    throw new Error(`Bad response from post-login endpoint ${postLoginResponse.status}: ${postLoginResponse.statusText}`)
  }
}
