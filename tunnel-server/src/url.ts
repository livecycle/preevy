import lodash from 'lodash'

export const editUrl = (
  url: URL | string,
  { hostname, queryParams }: Partial<{ hostname: string; queryParams: Record<string, string> }>,
) => {
  const u = new URL(url.toString())
  return Object.assign(u, {
    ...hostname ? { hostname } : {},
    ...queryParams ? {
      search: new URLSearchParams(lodash.defaults(queryParams, Object.fromEntries(u.searchParams.entries()))),
    } : {},
  })
}
