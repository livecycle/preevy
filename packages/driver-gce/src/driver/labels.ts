import { createHash } from 'crypto'

export const LABELS = {
  ENV_ID_HASH_SHA1_HEX: 'preevy-env-id-hash-sha1-hex',
  PROFILE_ID_HASH_SHA1_HEX: 'preevy-profile-id-hash-sha1-hex',
}

export const sha1hex = (s: string) => createHash('sha1').update(s).digest('hex')
