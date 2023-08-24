import { truncateWithHash } from '@preevy/core'

export const LABELS = {
  OLD_PROFILE_ID: 'preevy-profile-id',
  OLD_ENV_ID: 'preevy-env-id',
  ENV_ID: 'preevy-env-id-normalized',
  PROFILE_ID: 'preevy-profile-id-normalized',
}

// https://cloud.google.com/compute/docs/labeling-resources#requirements
export const isValidLabel = (label: string) => label.length <= 63 && /[a-z0-9_-]/.test(label)

export const normalizeLabel = (s: string) => truncateWithHash(s, 63).toLowerCase()
