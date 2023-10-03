import { IncomingMessage, ServerResponse, OutgoingHttpHeaders, IncomingHttpHeaders } from 'http'
import zlib from 'zlib'
import stream from 'stream'
import { parse as parseContentType } from 'content-type'
import iconv from 'iconv-lite'
import { inspect } from 'node:util'
import { Logger } from 'pino'
import { InjectHtmlScriptTransform } from './inject-transform'
import { ScriptInjectionBase, ScriptInjection } from '../../tunnel-store'

const incomingEtagHeaders = ['if-none-match', 'if-match'] as const
export const removeEtagSuffix = (headers: IncomingHttpHeaders) => {
  for (const header of incomingEtagHeaders) {
    const value = headers[header]
    if (value) {
      headers[header] = value.replace(/\+preevy:[^"]+/, '')
    }
  }
}

const addEtagSuffix = (headers: OutgoingHttpHeaders, added: string) => {
  if (headers.etag && typeof headers.etag === 'string') {
    headers.etag = headers.etag.replace(/"$/, `+preevy:${added}"`)
  }
}

const compressionsForContentEncoding = (
  contentEncoding: string | undefined,
): [stream.Transform, stream.Transform] | undefined => {
  if (!contentEncoding || contentEncoding === 'identity') {
    return undefined
  }
  if (contentEncoding === 'gzip') {
    return [zlib.createGunzip(), zlib.createGzip()]
  }
  if (contentEncoding === 'deflate') {
    return [zlib.createInflate(), zlib.createDeflate()]
  }
  if (contentEncoding === 'br') {
    return [zlib.createBrotliDecompress(), zlib.createBrotliCompress()]
  }
  throw new Error(`unsupported content encoding: ${inspect(contentEncoding)}`)
}

const streamsForContentEncoding = (
  contentEncoding: string | undefined,
  input: stream.Readable,
  output: stream.Writable,
): [stream.Readable, stream.Writable] => {
  const compress = compressionsForContentEncoding(contentEncoding)
  if (!compress) {
    return [input, output]
  }
  compress[1].pipe(output)
  return [input.pipe(compress[0]), compress[1]]
}

const proxyWithInjection = (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
  injects: Omit<ScriptInjection, 'pathRegex'>[],
  charset = 'utf-8',
) => {
  const resHeaders = { ...proxyRes.headers }

  // enable default node chunked encoding when possible
  delete resHeaders['transfer-encoding']
  delete resHeaders['content-length']
  delete resHeaders.connection

  // ranges not compatible with injection
  delete resHeaders['accept-ranges']

  const transform = new InjectHtmlScriptTransform(injects)
  addEtagSuffix(resHeaders, transform.scriptTagsEtag())

  res.writeHead(proxyRes.statusCode as number, resHeaders)

  const [input, output] = streamsForContentEncoding(proxyRes.headers['content-encoding'], proxyRes, res)

  input
    .pipe(iconv.decodeStream(charset))
    .pipe(transform)
    .pipe(iconv.encodeStream(charset))
    .pipe(output)
}

const proxyWithoutInjection = (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
) => {
  res.writeHead(proxyRes.statusCode as number, proxyRes.headers)
  proxyRes.pipe(res)
}

export const proxyResHandler = (
  { log, injectsMap }: { log: Logger; injectsMap: Pick<WeakMap<object, ScriptInjectionBase[]>, 'get' | 'delete'> },
) => (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  req: Pick<IncomingMessage, never>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
) => {
  const injects = injectsMap.get(req)
  if (!injects) {
    return proxyWithoutInjection(proxyRes, res)
  }
  injectsMap.delete(req)

  const contentTypeHeader = proxyRes.headers['content-type']

  if (!contentTypeHeader) {
    return proxyWithoutInjection(proxyRes, res)
  }

  const { type: contentType, parameters: { charset } } = parseContentType(contentTypeHeader)
  if (contentType !== 'text/html') {
    return proxyWithoutInjection(proxyRes, res)
  }

  try {
    return proxyWithInjection(proxyRes, res, injects, charset)
  } catch (e) {
    log.warn(`error trying to inject scripts: ${inspect(e)}`)
  }

  return proxyWithoutInjection(proxyRes, res)
}
