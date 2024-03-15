import { join } from 'node:path'
import { editUrl } from '../url.js'

export const calcLoginUrl = (
  { baseUrl, env, returnPath }: { baseUrl: URL; env: string; returnPath?: string },
) => editUrl(baseUrl, {
  hostname: `auth.${baseUrl.hostname}`,
  path: '/login',
  queryParams: {
    env,
    ...(returnPath && { returnPath }),
  },
}).toString()

export const calcSaasLoginUrl = ({
  baseUrl,
  saasBaseUrl,
  env,
  returnPath,
}: {
  baseUrl: URL
  saasBaseUrl: URL
  env: string
  returnPath?: string
}) => editUrl(saasBaseUrl, {
  queryParams: { redirectTo: calcLoginUrl({ baseUrl, env, returnPath }) },
  path: join(saasBaseUrl.pathname, '/api/auth/login'),
}).toString()
