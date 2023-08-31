import { IncomingMessage, ServerResponse } from 'http'
import zlib from 'zlib'
import stream from 'stream'
import { parse as parseContentType, format as formatContentType } from 'content-type'
import { parseDocument } from 'htmlparser2'
import { Document, Element } from 'domhandler'
import { render as renderHtml } from 'dom-serializer'
import { prependChild, findOne } from 'domutils'
import { INJECT_SCRIPTS_HEADER } from './common'

const readStream = (
  s: stream.Readable,
  encoding: BufferEncoding,
): Promise<string> => new Promise<string>((resolve, reject) => {
  const buffers: Buffer[] = []
  s.on('error', reject)
  s.on('data', data => buffers.push(data))
  s.on('end', () => resolve(Buffer.concat(buffers).toString(encoding)))
})

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

const ensureHead = (document: Document) => {
  const head = findOne(e => e.tagName === 'head', document.childNodes)
  if (head) {
    return head
  }

  const parent = findOne(e => e.tagName === 'html', document.childNodes) ?? document
  const newHead = new Element('head', {})
  prependChild(parent, newHead)
  return newHead
}

export const injectScripts = async (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  req: Pick<IncomingMessage, 'headers'>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
) => {
  const scriptUrls = req.headers[INJECT_SCRIPTS_HEADER] as string[] | undefined
  if (!scriptUrls?.length) {
    return undefined
  }

  const {
    type: contentType,
    parameters: { charset: reqCharset, ...reqContentTypeParams },
  } = parseContentType(proxyRes)

  if (!contentType.includes('text/html')) {
    return undefined
  }

  res.writeHead(proxyRes.statusCode as number, {
    ...proxyRes.headers,
    'content-type': formatContentType({
      type: contentType,
      parameters: { ...reqContentTypeParams, charset: 'utf-8' },
    }),
  })

  const compress = compressionsForContentEncoding(proxyRes.headers['content-encoding'] || 'identity')

  const [input, output] = compress
    ? [proxyRes.pipe(compress[0]), res.pipe(compress[1])]
    : [proxyRes, res]

  const html = await readStream(input, reqCharset as BufferEncoding ?? 'utf-8')
  const document = parseDocument(html, { lowerCaseTags: true })
  const head = ensureHead(document)

  scriptUrls.forEach(url => {
    prependChild(head, new Element('script', { src: url }))
  })

  output.end(renderHtml(document))
  return undefined
}
