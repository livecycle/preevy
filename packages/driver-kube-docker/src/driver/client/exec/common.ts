import { Readable } from 'stream'

export type BaseExecOpts = {
  pod: string
  container: string
  command: string[]
  stdin?: string | Buffer | Readable
  tty?: boolean
}
