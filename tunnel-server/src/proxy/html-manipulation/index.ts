import { IncomingMessage, ServerResponse } from 'http'
import zlib from 'zlib'
import stream from 'stream'
import { parse as parseContentType } from 'content-type'
import iconv from 'iconv-lite'
import { inspect } from 'node:util'
import { Logger } from 'pino'
import { INJECT_SCRIPTS_HEADER } from '../common'
import { InjectHtmlScriptTransform } from './inject-transform'
import { ScriptInjection } from '../../tunnel-store'

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
  res.writeHead(proxyRes.statusCode as number, { ...proxyRes.headers, 'transfer-encoding': '' })

  const [input, output] = streamsForContentEncoding(proxyRes.headers['content-encoding'], proxyRes, res)

  const transform = new InjectHtmlScriptTransform(injects)

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

export const proxyResHandler = ({ log }: { log: Logger }) => (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  req: Pick<IncomingMessage, 'headers'>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
) => {
  const injectsStr = req.headers[INJECT_SCRIPTS_HEADER] as string | undefined
  const contentTypeHeader = proxyRes.headers['content-type']

  if (!injectsStr || !contentTypeHeader) {
    return proxyWithoutInjection(proxyRes, res)
  }

  const {
    type: contentType,
    parameters: { charset },
  } = parseContentType(contentTypeHeader)

  if (contentType !== 'text/html') {
    return proxyWithoutInjection(proxyRes, res)
  }

  let injects: Omit<ScriptInjection, 'pathRegex'>[]
  try {
    injects = JSON.parse(injectsStr)
  } catch (e) {
    log.warn(`invalid JSON in ${INJECT_SCRIPTS_HEADER} header: ${inspect(e)}`)
    return proxyWithoutInjection(proxyRes, res)
  }

  try {
    return proxyWithInjection(proxyRes, res, injects, charset)
  } catch (e) {
    log.warn(`error trying to inject scripts: ${inspect(e)}`)
  }

  return proxyWithoutInjection(proxyRes, res)
}
