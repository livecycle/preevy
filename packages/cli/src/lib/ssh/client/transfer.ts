import { TransferProgressEmitter } from './progress'

export type TransferOptions = {
  mode?: number | string
  progress?: TransferProgressEmitter
  chunkSize?: number
}
