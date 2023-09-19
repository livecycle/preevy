import { IncomingMessage, ServerResponse } from 'http'
import zlib from 'zlib'
import stream from 'stream'
import { parse as parseContentType } from 'content-type'
import iconv from 'iconv-lite'
import { inspect } from 'node:util'
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

export const injectScripts = (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  req: Pick<IncomingMessage, 'headers'>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
) => {
  const injectsStr = req.headers[INJECT_SCRIPTS_HEADER] as string | undefined
  const contentTypeHeader = proxyRes.headers['content-type']

  if (!injectsStr || !contentTypeHeader) {
    res.writeHead(proxyRes.statusCode as number, proxyRes.headers)
    proxyRes.pipe(res)
    return undefined
  }

  const {
    type: contentType,
    parameters: { charset: reqCharset },
  } = parseContentType(contentTypeHeader)

  if (contentType !== 'text/html') {
    res.writeHead(proxyRes.statusCode as number, proxyRes.headers)
    proxyRes.pipe(res)
    return undefined
  }

  res.writeHead(proxyRes.statusCode as number, { ...proxyRes.headers, 'transfer-encoding': '' })

  const [input, output] = streamsForContentEncoding(proxyRes.headers['content-encoding'], proxyRes, res)

  const injects = JSON.parse(injectsStr) as Omit<ScriptInjection, 'pathRegex'>[]
  const transform = new InjectHtmlScriptTransform(injects)

  input
    .pipe(iconv.decodeStream(reqCharset || 'utf-8'))
    .pipe(transform)
    .pipe(iconv.encodeStream(reqCharset || 'utf-8'))
    .pipe(output)

  return undefined
}
