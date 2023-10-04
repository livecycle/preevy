import zlib from 'zlib'
import stream from 'stream'
import { inspect } from 'node:util'

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

export const streamsForContentEncoding = (
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
