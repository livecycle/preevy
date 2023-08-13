import { parseKey } from '@preevy/common'
import * as jose from 'jose'
import crypto from 'crypto'
import fetch from 'node-fetch'
import { TokenExpiredError, TokesFileSchema, getTokensFromLocalFs } from '../login'
import { profileStore } from './store'
import { Store, localFs } from '../store'
import { Logger } from '../log'

export type Org = {id: string; name: string; role: string}

const keyTypeToArgs = {
  rsa: 'RS256',
  ed25519: 'EdDSA',
}

export const link = async (
  store: Store,
  dataDir: string,
  lcUrl: string,
  logger: Logger,
  promptUserWithChooseOrg: (orgs: Org[]) => Promise<Org>
) => {
  let tokens: TokesFileSchema | undefined
  try {
    tokens = await getTokensFromLocalFs(localFs(dataDir))
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      throw new Error('Session is expired, please log in again')
    }
    throw e
  }

  if (tokens === undefined) {
    throw new Error('Please log in to link profile')
  }

  const orgsResponse = await fetch(
    `${lcUrl}/api/user/orgs`,
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
  })

  const pk = crypto.createPublicKey(prk)
  if (pk.asymmetricKeyType === undefined) throw new Error('Error getting type of public ket')
  if (!(pk.asymmetricKeyType in keyTypeToArgs)) throw new Error(`Unsupported key algorithm: ${pk.asymmetricKeyType}`)

  const tokenSignedByTunnelingPrivateKey = await new jose.SignJWT({})
    .setProtectedHeader({ alg: keyTypeToArgs[pk.asymmetricKeyType as keyof typeof keyTypeToArgs] })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(prk)

  const linkResponse = await fetch(
    `${lcUrl}/api/org/${chosenOrg.id}/profiles`,
    { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.access_token}` },
      body: JSON.stringify({ profileTunnellingPublicKey: pk.export({ format: 'jwk' }), tokenSignedByTunnelingPrivateKey, idToken: tokens.id_token }) }
  )

  if (!linkResponse.ok) throw new Error(`Error while requesting to link ${linkResponse.status}: ${linkResponse.statusText}`)

  logger.info(`Linked current profile to org ${chosenOrg.name} successfully! 🤘`)
}
