import { describe, it, expect, beforeEach } from '@jest/globals'
import stream from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { promisify } from 'node:util'
import { InjectHtmlScriptTransform, InjectTransform } from './inject-transform'

// taken from: https://nodejs.org/api/stream.html#decoding-buffers-in-a-writable-stream
class StringWritable extends stream.Writable {
  private readonly decoder: StringDecoder
  public data = ''
  constructor(options?: stream.WritableOptions) {
    super(options)
    this.decoder = new StringDecoder(options && options.defaultEncoding)
    this.data = ''
  }

  // eslint-disable-next-line no-underscore-dangle
  _write(chunk: Buffer | string, encoding: BufferEncoding | 'buffer', callback: (error?: Error | null) => void) {
    const c = encoding === 'buffer' ? this.decoder.write(chunk as Buffer) : chunk
    this.data += c
    callback()
  }

  // eslint-disable-next-line no-underscore-dangle
  _final(callback: () => void) {
    this.data += this.decoder.end()
    callback()
  }
}

// describe('InjectTransform', () => {
//   const inject = async (toInject: string, indexToInject: number, ...source: string[]) => {
//     const t = new InjectTransform(toInject)
//     t.offsetToInject = indexToInject
//     const s = new StringWritable()
//     await promisify(stream.pipeline)(stream.Readable.from(source), t, s)
//     return s.data
//   }

//   describe('when the injection is at offset 0', () => {
//     let result: string

//     beforeEach(async () => {
//       result = await inject('<injected>', 0, 'abc', 'def')
//     })

//     it('should inject', () => {
//       expect(result).toBe('<injected>abcdef')
//     })
//   })

//   describe('when the injection is at a middle offset', () => {
//     let result: string

//     beforeEach(async () => {
//       result = await inject('<injected>', 2, 'abc', 'def')
//     })

//     it('should inject', () => {
//       expect(result).toBe('ab<injected>cdef')
//     })
//   })

//   describe('when the injection is at the end', () => {
//     let result: string

//     beforeEach(async () => {
//       result = await inject('<injected>', 6, 'abc', 'def')
//     })

//     it('should inject', () => {
//       expect(result).toBe('abcdef<injected>')
//     })
//   })

//   describe('when the injection index is set too late', () => {
//     it('should throw', async () => {
//       const t = new InjectTransform('<injected>')
//       t.on('data', () => { t.offsetToInject = 0 })
//       const s = new StringWritable()
//       return await expect(() => promisify(stream.pipeline)(
//         stream.Readable.from(['abc', 'def']),
//         t,
//         s,
//       )).rejects.toThrow('Stream at position 3, already passed the index to inject: 0')
//     })
//   })
// })

describe('InjectHtmlScriptTransform', () => {
  const inject = async (...sourceChunks: string[]) => {
    const t = new InjectHtmlScriptTransform([{ src: '1.js' }, { src: '2.js', defer: true, async: true }])
    const s = new StringWritable()
    await promisify(stream.pipeline)(stream.Readable.from(sourceChunks), t, s)
    return s.data
  }

  describe('when there is a head tag', () => {
    let result: string

    beforeEach(async () => {
      result = await inject(
        '<html',
        ' lang="en"><he',
        'ad f',
        'oo="bar"><script src="b"></script></hea',
        'd></html>',
      )
    })

    it('should inject script tags and the start of the head element', () => {
      expect(result).toBe('<html lang="en"><head foo="bar"><script src="1.js"></script><script src="2.js" async defer></script><script src="b"></script></head></html>')
    })
  })

  describe('when there is a head tag as well as a body tag in the same chunk', () => {
    let result: string

    beforeEach(async () => {
      result = await inject(
        '<html lang="en"><head foo="bar"><script src="b"></script></head><body><p>hello</p></body></html>',
      )
    })

    it('should inject script tags at the start of the head element', () => {
      expect(result).toBe('<html lang="en"><head foo="bar"><script src="1.js"></script><script src="2.js" async defer></script><script src="b"></script></head><body><p>hello</p></body></html>')
    })
  })

  describe('when there is no head tag but there is a body tag', () => {
    let result: string

    beforeEach(async () => {
      result = await inject(
        '<html',
        ' lang="en"><bo',
        'dy><p>hello</p></body></html>',
      )
    })

    it('should inject a head element with script tags, just before the body', () => {
      expect(result).toBe('<html lang="en"><head><script src="1.js"></script><script src="2.js" async defer></script></head><body><p>hello</p></body></html>')
    })
  })

  describe('when there are no head or body tags', () => {
    let result: string

    beforeEach(async () => {
      result = await inject(
        '<title>hello</title>',
      )
    })

    it('should inject a head element with script tags, at the end', () => {
      expect(result).toBe('<title>hello</title><head><script src="1.js"></script><script src="2.js" async defer></script></head>')
    })
  })
})
