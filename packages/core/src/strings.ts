import { createHash, randomInt } from 'crypto'
import { mapValues } from 'lodash'

export const truncatePrefix = (prefix: string, suffix: string, maxLength: number, separator = '-') => {
  const truncateLength = maxLength - suffix.length - separator.length
  return [prefix.substring(0, truncateLength), suffix].join(separator)
}

export const truncateWithHash = (s: string, maxLength: number, hashLength = 4, separator = '-') => {
  if (s.length <= maxLength) {
    return s
  }

  const suffix = createHash('md5').update(s).digest('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, hashLength)

  return truncatePrefix(s, suffix, maxLength, separator)
}

const lowercase = 'abcdefghijklmnopqrstuvwxyz'
const numeric = '0123456789'

export const alphabets = Object.freeze({
  alphanumeric: lowercase + lowercase.toUpperCase() + numeric,
  lowercase,
  lowercaseNumeric: lowercase + numeric,
} as const)

const randomStringFunc = (
  alphabet: string,
  length: number,
) => Array.from({ length }, () => alphabet.charAt(randomInt(alphabet.length))).join('')

export const randomString = Object.assign(
  randomStringFunc,
  mapValues(alphabets, alphabet => randomStringFunc.bind(null, alphabet)),
)
