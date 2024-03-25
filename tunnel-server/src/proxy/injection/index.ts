import { ClientRequest, IncomingMessage, ServerResponse } from 'http'
import stream from 'stream'
import { parse as parseContentType } from 'content-type'
import iconv from 'iconv-lite'
import { inspect } from 'node:util'
import { Logger, Level } from 'pino'
import { InjectHtmlScriptTransform } from './inject-transform.js'
import { addOutgoingEtagSuffix, removeIncomingEtagSuffix } from './etag.js'
import { streamsForContentEncoding } from './content-encoding.js'
import { InjectedContent, injectedContentFromSpec } from './injected-content.js'
import { ScriptInjectionSpec } from './model.js'

export { ScriptInjectionSpec, ScriptInjectionSpecBase } from './model.js'

const proxyWithInjection = (
  proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
  res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
  injectedContent: InjectedContent,
  charset = 'utf-8',
) => {
  const resHeaders = { ...proxyRes.headers }

  // enable default node chunked encoding when possible
  delete resHeaders['transfer-encoding']
  delete resHeaders['content-length']
  delete resHeaders.connection

  // ranges not compatible with injection
  delete resHeaders['accept-ranges']

  const transform = new InjectHtmlScriptTransform(injectedContent.scriptElements)
  addOutgoingEtagSuffix(resHeaders, injectedContent.etag)

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

export const proxyInjectionHandlers = (
  { log }: { log: Logger<Level> },
) => {
  const injectedContentForReq = new WeakMap<IncomingMessage, InjectedContent>()
  return {
    setInjectsForReq: (req: IncomingMessage, injectSpec: ScriptInjectionSpec[] | undefined) => {
      const injects = injectSpec
        ?.filter(({ pathRegex }) => !pathRegex || (req.url && pathRegex.test(req.url)))

      if (injects?.length) {
        const content = injectedContentFromSpec(injects)
        injectedContentForReq.set(req, content)
      }
    },
    proxyReqHandler: (
      proxyReq: ClientRequest,
      req: IncomingMessage,
    ) => {
      const content = injectedContentForReq.get(req)
      if (content) {
        removeIncomingEtagSuffix(proxyReq, content.etag)
      }
    },
    proxyResHandler: (
      proxyRes: stream.Readable & Pick<IncomingMessage, 'headers' | 'statusCode'>,
      req: IncomingMessage,
      res: stream.Writable & Pick<ServerResponse<IncomingMessage>, 'writeHead'>,
    ) => {
      const content = injectedContentForReq.get(req)
      if (!content) {
        return proxyWithoutInjection(proxyRes, res)
      }

      const contentTypeHeader = proxyRes.headers['content-type']

      if (!contentTypeHeader) {
        return proxyWithoutInjection(proxyRes, res)
      }

      const { type: contentType, parameters: { charset } } = parseContentType(contentTypeHeader)
      if (contentType !== 'text/html') {
        return proxyWithoutInjection(proxyRes, res)
      }

      try {
        return proxyWithInjection(proxyRes, res, content, charset)
      } catch (e) {
        log.warn(`error trying to inject scripts: ${inspect(e)}`)
      }

      return proxyWithoutInjection(proxyRes, res)
    },
  }
}
