import { TransferProgressEmitter } from './progress.js'

export type TransferOptions = {
  mode?: number | string
  progress?: TransferProgressEmitter
  chunkSize?: number
}
