import { Args, ux } from '@oclif/core'
import { jwkThumbprint, jwkThumbprintUri, parseKey, profileStore } from '@preevy/core'
import { formatPublicKey } from '@preevy/common'
import ProfileCommand from '../../profile-command'

const keyTypes = ['private', 'public-pem', 'public-ssh', 'thumbprint', 'thumbprint-uri'] as const
type KeyType = typeof keyTypes[number]

const extractKey = async (key: Buffer, type: KeyType) => {
  if (type === 'thumbprint-uri') {
    return await jwkThumbprintUri(key)
  }
  if (type === 'thumbprint') {
    return await jwkThumbprint(key)
  }
  if (type === 'public-pem') {
    return parseKey(key).getPublicPEM()
  }
  if (type === 'public-ssh') {
    return formatPublicKey(key)
  }
  if (type === 'private') {
    return parseKey(key).getPrivatePEM()
  }

  throw new Error(`Invalid key type "${type}"`)
}

// eslint-disable-next-line no-use-before-define
export default class CurrentProfile extends ProfileCommand<typeof CurrentProfile> {
  static description = 'Display current profile in use'
  static strict = false

  static enableJsonFlag = true

  static args = {
    type: Args.custom<KeyType>({
      description: 'type of the key to display',
      options: keyTypes.map(s => s),
      default: 'thumbprint-uri',
    })(),
  }

  async run(): Promise<unknown> {
    const tunnelingKey = await profileStore(this.store).getTunnelingKey()
    if (tunnelingKey === undefined) {
      throw new Error('Could not find tunneling key in profile store')
    }
    const value = await extractKey(tunnelingKey, this.args.type as KeyType)
    if (this.flags.json) {
      return value
    }
    ux.log(value)
    return undefined
  }
}
