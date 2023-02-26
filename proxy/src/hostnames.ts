export const parseHostAndPort = (hostAndPort: string) => {
  const match = /^((?<service>.+)_)?(?<host>[^_.]+)\..*/.exec(hostAndPort)
  return match?.groups && { host: match.groups["host"], service: match.groups["service"] ?? "default" }
}
