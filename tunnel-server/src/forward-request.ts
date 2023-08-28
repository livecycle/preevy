export const access = ['private', 'public'] as const

export type Accesss = typeof access[number]

export type ForwardRequest = {
  path: string
  access: Accesss
  meta: Record<string, unknown>
}

export const parseForwardRequest = (request: string) => {
  const [path, paramStr] = request.split('#')
  const forwardRequest: Partial<ForwardRequest> = { path: path.replace(/^\//, ''), access: 'public' }

  const params = paramStr?.split(';').map(kvp => kvp.split('=', 2)) ?? []
  for (const [k, v] of params) {
    if (k === 'access') {
      if (!(access as readonly string[]).includes(v)) {
        throw new Error(`invalid access "${v}" in request "${request}", allowed values: ${access.join(', ')}`)
      }
      forwardRequest.access = v as Accesss
    } else if (k === 'meta') {
      try {
        forwardRequest.meta = JSON.parse(Buffer.from(v, 'base64url').toString('utf-8'))
      } catch (e) {
        throw new Error(`invalid meta in request: ${v}`)
      }
    } else {
      throw new Error(`invalid param "${k}" in request "${request}"`)
    }
  }

  return forwardRequest as ForwardRequest
}
