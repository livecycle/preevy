/* eslint-disable no-underscore-dangle */
import stream from 'stream'
import { Parser } from 'htmlparser2'
import { ScriptInjection } from '../../tunnel-store'

const positions = ['head-content-start', 'before-body-tag', 'html-content-end'] as const
type Position = typeof positions[number]

type HtmlDetector = {
  write: (chunk: string) => undefined
    | { position: Position; offset: number }
}

const htmlDetector = (): HtmlDetector => {
  let detected: ReturnType<HtmlDetector['write']>

  const parser = new Parser({
    onopentag: name => {
      if (name === 'head') {
        detected ||= { position: 'head-content-start', offset: parser.endIndex + 1 }
      }
    },
    onopentagname: name => {
      if (name === 'body') {
        detected ||= { position: 'before-body-tag', offset: parser.startIndex }
      }
    },
    onclosetag: name => {
      if (name === 'html') {
        detected ||= { position: 'html-content-end', offset: parser.startIndex }
      }
    },
  }, { decodeEntities: false, lowerCaseTags: true })

  return {
    write: (chunk: string) => {
      parser.write(chunk)
      return detected
    },
  }
}

const scriptTag = (
  { src, async, defer }: Omit<ScriptInjection, 'pathRegex'>,
) => `<script ${[`src="${src}"`, async && 'async', defer && 'defer'].filter(Boolean).join(' ')}></script>`

export class InjectHtmlScriptTransform extends stream.Transform {
  readonly detector = htmlDetector()
  stringSoFar = ''
  currentChunkOffset = 0
  injected = false

  constructor(readonly injects: Omit<ScriptInjection, 'pathRegex'>[]) {
    super({ decodeStrings: false, encoding: 'utf-8' })
  }

  // avoid pushing an empty string: https://nodejs.org/api/stream.html#readablepush
  pushNonEmpty(chunk: string): void {
    if (chunk.length) {
      super.push(chunk)
    }
  }

  private scriptTags() {
    return this.injects.map(scriptTag).join('')
  }

  private headWithScriptTags() {
    return `<head>${this.scriptTags()}</head>`
  }

  private stringToInject(position: Position) {
    if (position === 'head-content-start') {
      return this.scriptTags()
    }
    return this.headWithScriptTags()
  }

  override _transform(chunk: string, _encoding: BufferEncoding | 'buffer', callback: stream.TransformCallback): void {
    if (typeof chunk !== 'string') {
      // chunk must be string rather than Buffer so htmlDetector offsets would be in character units, not bytes
      throw new Error(`Invalid chunk, expected string, received ${Buffer.isBuffer(chunk) ? 'Buffer' : typeof chunk}: ${chunk}`)
    }

    if (this.injected) {
      // after the injection happened, pass chunks through as-is
      this.pushNonEmpty(chunk)
      callback(null)
      return undefined
    }

    this.stringSoFar += chunk

    const detected = this.detector.write(chunk)
    if (!detected) {
      // do not pass chunks through until an injected position is found,
      //  otherwise the inject target may be in a previously passed-through chunk
      callback(null)
      return undefined
    }

    this.pushNonEmpty(this.stringSoFar.slice(0, detected.offset))
    this.push(this.stringToInject(detected.position))
    this.pushNonEmpty(this.stringSoFar.slice(detected.offset))

    this.stringSoFar = ''
    this.injected = true

    callback(null)
    return undefined
  }

  override _final(callback: (error?: Error | null | undefined) => void): void {
    this.pushNonEmpty(this.stringSoFar)
    if (!this.injected) {
      this.push(this.headWithScriptTags())
    }
    callback(null)
  }
}
