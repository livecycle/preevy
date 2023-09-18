import { IncomingMessage, ServerResponse } from 'http'
import zlib from 'zlib'
import stream from 'stream'
import { parse as parseContentType } from 'content-type'
import iconv from 'iconv-lite'
import { INJECT_SCRIPTS_HEADER } from '../common'
import { InjectHtmlScriptTransform } from './inject-transform'
import { ScriptInjection } from '../../tunnel-store'

const compressionsForContentEncoding = (contentEncoding: string) => {
  if (contentEncoding === 'gzip') {
    return [zlib.createGunzip(), zlib.createGzip()] as const
  }
  if (contentEncoding === 'deflate') {
    return [zlib.createInflate(), zlib.createDeflate()] as const
  }
  if (contentEncoding === 'br') {
    return [zlib.createBrotliDecompress(), zlib.createBrotliCompress()] as const
  }
  if (contentEncoding === 'identity') {
    return undefined
  }
  throw new Error(`unsupported content encoding: "${contentEncoding}"`)
}

export const injectScripts = async (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  req: Pick<IncomingMessage, 'headers'>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
) => {
  res.writeHead(proxyRes.statusCode as number, proxyRes.headers)

  const injectsStr = req.headers[INJECT_SCRIPTS_HEADER] as string | undefined
  const contentTypeHeader = proxyRes.headers['content-type']

  if (!injectsStr || !contentTypeHeader) {
    proxyRes.pipe(res)
    return undefined
  }

  const {
    type: contentType,
    parameters: { charset: reqCharset },
  } = parseContentType(contentTypeHeader)

  if (contentType !== 'text/html') {
    proxyRes.pipe(res)
    return undefined
  }

  const compress = compressionsForContentEncoding(proxyRes.headers['content-encoding'] || 'identity')

  const [input, output] = compress
    ? [proxyRes.pipe(compress[0]), res.pipe(compress[1])]
    : [proxyRes, res]

  const injects = JSON.parse(injectsStr) as Omit<ScriptInjection, 'pathRegex'>[]
  const transform = new InjectHtmlScriptTransform(injects)

  input
    .pipe(iconv.decodeStream(reqCharset || 'utf-8'))
    .pipe(transform)
    .pipe(iconv.encodeStream(reqCharset || 'utf-8'))
    .pipe(output)

  return undefined
}
