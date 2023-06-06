import { parseKey } from '@preevy/common'
import { memoize } from 'lodash'

export const getUserCredentials = memoize((privateKey: string | Buffer) => {
  const parsedKey = parseKey(privateKey)
  const user = 'x-preevy-profile-key'
  return {
    user,
    password: parsedKey.sign(user).toString('base64'),
  }
})

export const withUserCredentials = (url: string, sshTunnelPrivateKey: string | Buffer) => {
  const { user, password } = getUserCredentials(sshTunnelPrivateKey)
  const parsed = new URL(url)
  parsed.username = user
  parsed.password = password
  return parsed.toString()
}
