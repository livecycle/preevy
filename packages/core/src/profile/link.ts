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

  if (!orgsResponse.ok) throw new Error(`Could not fetch orgs from Livecycle API. ${orgsResponse.status}: ${orgsResponse.statusText}`)

  const orgs = await orgsResponse.json() as Org[]

  let chosenOrg: Org
  if (orgs.length === 0) {
    throw new Error("Couldn't find any organization for current logged in user")
  } else if (orgs.length === 1) {
    [chosenOrg] = orgs
  } else {
    chosenOrg = await promptUserWithChooseOrg(orgs)
  }

  logger.info(`Linking to org ${chosenOrg.name}`)

  const tunnelingKey = await profileStore(store).getTunnelingKey()
  if (tunnelingKey === undefined) {
    throw new Error('Could not find tunneling key in profile store')
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

  const linkResponse = await fetch(
    `${lcUrl}/link`,
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access_token}` },
      body: JSON.stringify({ organization: chosenOrg.id, profileTunnellingPublicKey: pk.export({ format: 'pem', type: 'pkcs1' }), tokenSignedByTunnelingPrivateKey, idToken: tokens.id_token }) }
  )

  if (!linkResponse.ok) throw new Error(`Error while requesting to link ${linkResponse.status}: ${linkResponse.statusText}`)

  logger.info(`Linked current profile to org ${chosenOrg.name} successfully! 🤘`)
}
