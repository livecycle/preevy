import { truncateWithHash } from '../strings'

const MAX_DNS_LABEL_LENGTH = 63

const sanitizeHostName = (x:string) => x.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()

/**
Generate a key for tunnel store.
Return value should be safe to use as DNS subdomain.
Constraints:
- max length is 63 octets (== 63 ASCII chars)
- case insensitive
*/
export const activeTunnelStoreKey = (clientId: string, remotePath: string) => {
  if (clientId !== sanitizeHostName(clientId)) {
    throw new Error(`Invalid client id: "${clientId}"`)
  }

  const tunnelPath = remotePath.replace(/^\//, '')
  const tunnelPathLength = MAX_DNS_LABEL_LENGTH - clientId.length - 1
  const truncatedPath = truncateWithHash(
    tunnelPath,
    sanitizeHostName,
    tunnelPathLength,
  )
  return `${truncatedPath}-${clientId}`
}
