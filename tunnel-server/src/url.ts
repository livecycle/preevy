import { defaults, omit } from 'lodash-es'

export const editUrl = (
  url: URL | string,
  { hostname, queryParams, username, password, path, removeQueryParams }: Partial<{
    hostname: string
    queryParams: Record<string, string>
    username: string
    password: string
    path: string
    removeQueryParams: string[]
  }>,
): URL => {
  const u = new URL(url.toString())
  return Object.assign(u, {
    ...hostname ? { hostname } : {},
    ...{
      search: new URLSearchParams(omit(
        defaults(queryParams, Object.fromEntries(u.searchParams.entries())),
        ...(removeQueryParams ?? [])
      )),
    },
    ...username ? { username } : {},
    ...password ? { password } : {},
    ...path ? { pathname: path } : {},
  })
}
