import { ProcessOutputBuffers } from '@preevy/common'
import { ProcessError } from '@preevy/core'
import { Readable, Writable } from 'stream'

export type BaseExecOpts = {
  pod: string
  container: string
  command: string[]
  stdin?: string | Buffer | Readable
  tty?: boolean
}

export class ReadableBufferStream extends Readable {
  constructor(readonly buffer: Buffer | string | undefined) {
    super()
  }

  isRead = false

  // eslint-disable-next-line no-underscore-dangle
  _read(): void {
    if (this.isRead || !this.buffer) {
      this.push(null)
    } else {
      this.push(Buffer.isBuffer(this.buffer) ? this.buffer : Buffer.from(this.buffer as string))
    }
    this.isRead = true
  }
}

export const callbackWritableStream = (onWrite: (chunk: Buffer) => void) => new Writable({
  write: (chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void) => {
    onWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    callback()
  },
})

export class ExecError extends Error {
  constructor(
    readonly command: string[],
    readonly output: ProcessOutputBuffers,
    readonly code?: number,
  ) {
    super(ProcessError.calcMessage(command, code ?? null, null, output))
  }
}
