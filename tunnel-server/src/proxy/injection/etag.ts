import { OutgoingHttpHeaders, ClientRequest } from 'http'

const injectedContentEtagHeaderSuffix = (injectedContentEtag: string) => `+preevy:${injectedContentEtag}`

const incomingEtagHeaders = ['if-none-match', 'if-match'] as const

export const removeIncomingEtagSuffix = (req: ClientRequest, injectedContentEtag: string) => {
  const headerSuffix = injectedContentEtagHeaderSuffix(injectedContentEtag)
  for (const header of incomingEtagHeaders) {
    const valueOrValues = req.getHeader(header)
    if (valueOrValues) {
      const values = Array.isArray(valueOrValues) ? valueOrValues : [valueOrValues]
      req.setHeader(header, values.map(value => value.toString().replace(headerSuffix, '')))
    }
  }
}

export const addOutgoingEtagSuffix = (headers: OutgoingHttpHeaders, injectedContentEtag: string) => {
  if (typeof headers.etag === 'string') {
    headers.etag = headers.etag.replace(/"$/, `${injectedContentEtagHeaderSuffix(injectedContentEtag)}"`)
  }
}
