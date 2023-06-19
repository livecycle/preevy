import { parseKey } from '@preevy/common'
import * as jose from 'jose'
import crypto from 'crypto'
import fetch from 'node-fetch'
import { TokenExpiredError, TokesFileSchema, getTokens } from '../login'
import { profileStore } from './store'
import { Store } from '../store'
import { Logger } from '../log'

export type Org = {id: string; name: string; role: string}

export const link = async (
  store: Store,
  dataDir: string,
  lcUrl: string,
  logger: Logger,
  promptUserWithChooseOrg: (orgs: Org[]) => Promise<Org>
) => {
  let tokens: TokesFileSchema | undefined
  try {
    tokens = await getTokens(dataDir)
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      logger.info('Session is expired, please log in again')
      return
    }
    throw e
  }

  if (tokens === undefined) {
    logger.info('Please log in to link profile')
    return
  }

  const orgsResponse = await fetch(
    `${lcUrl}/orgs`,
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access_token}` } }
  )

  // TODO error handling

  const orgs = await orgsResponse.json() as Org[]
  logger.info('orgs', orgs)
  let chosenOrg: Org
  if (orgs.length === 0) {
    throw new Error('Organization not found for user')
  } else if (orgs.length === 1) {
    [chosenOrg] = orgs
  } else {
    chosenOrg = await promptUserWithChooseOrg(orgs)
  }

  const tunnelingKey = await profileStore(store).getTunnelingKey()
  if (tunnelingKey === undefined) {
    throw new Error('could not find key')
  }

  const parsed = parseKey(tunnelingKey)

  const prk = crypto.createPrivateKey({
    key: parsed.getPrivatePEM(),
    format: 'pem',
    type: 'pkcs1',
  })

  const pk = crypto.createPublicKey(prk)

  const tokenSignedByTunnelingPrivateKey = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(prk)

  logger.info(tokenSignedByTunnelingPrivateKey)
  logger.info('public key', pk.export({ format: 'pem', type: 'pkcs1' }))
  logger.info('org', chosenOrg)
  const response = await fetch(
    `${lcUrl}/link`,
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access_token}` },
      body: JSON.stringify({ organization: chosenOrg.id, profileTunnellingPublicKey: pk.export({ format: 'pem', type: 'pkcs1' }), tokenSignedByTunnelingPrivateKey, idToken: tokens.id_token }) }
  )

  logger.info('got response', response.status, await response.text(), response.headers.raw())
}
