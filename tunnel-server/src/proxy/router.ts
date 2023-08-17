import { IncomingMessage } from 'http'
import type { Logger } from 'pino'
import { ActiveTunnel, ActiveTunnelStore } from '../tunnel-store'

const tunnelPathRe = /^\/proxy\/([^/]+)(\/.*)/
const parseTunnelPath = (path: string) => {
  const match = tunnelPathRe.exec(path)
  return match && {
    tunnel: match[1],
    path: match[2] as `/${string}` | undefined,
  }
}

const hostRe = /^([^.:]+)\.([^:]+)(:([0-9]+))?/
const parseHostHeader = (hostHeader: string) => {
  const match = hostRe.exec(hostHeader)
  return match && {
    firstLabel: match[1],
    lastLabels: match[2],
  }
}

export type TunnelFinder = (
  activeTunnelStore: ActiveTunnelStore
) => Promise<undefined | { path: string; activeTunnel: ActiveTunnel }>

export const proxyRouter = (
  { log, baseHostname }: { log: Logger; baseHostname: string },
): ((req: IncomingMessage) => undefined | TunnelFinder) => {
  const tunnelFinderFromHostname = (
    { headers: { host: hostHeader }, method, url }: Pick<IncomingMessage, 'headers' | 'url' | 'method'>,
  ): TunnelFinder | undefined => {
    if (!hostHeader) {
      log.warn('no host header for request: %j', { url, host: hostHeader, method })
      return undefined
    }
    const parsed = parseHostHeader(hostHeader)
    if (parsed?.lastLabels !== baseHostname) {
      return undefined
    }

    return async activeTunnelStore => {
      const activeTunnel = await activeTunnelStore.get(parsed.firstLabel)
      return activeTunnel
        ? { path: url as string, activeTunnel }
        : undefined
    }
  }

  const tunnelFinderFromPath = (
    { url, headers, method }: Pick<IncomingMessage, 'url' | 'headers' | 'method'>,
  ): TunnelFinder | undefined => {
    if (!url) {
      log.warn('no url for request: %j', { url, host: headers.host, method })
      return undefined
    }
    const parsedPath = parseTunnelPath(url)
    if (!parsedPath) {
      return undefined
    }

    const { tunnel, path } = parsedPath

    return async activeTunnelStore => {
      const activeTunnel = await activeTunnelStore.get(tunnel)
      return activeTunnel
        ? { path: path as string, activeTunnel }
        : undefined
    }
  }

  return (req: IncomingMessage) => tunnelFinderFromHostname(req) ?? tunnelFinderFromPath(req)
}
