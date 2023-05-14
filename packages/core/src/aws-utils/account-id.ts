import { STS } from '@aws-sdk/client-sts'

export const ambientAccountId = async (region: string) => {
  const sts = new STS({ region })
  const { Account: account } = await sts.getCallerIdentity({})
  return account
}
