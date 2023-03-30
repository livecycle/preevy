import { SimpleEmitter, simpleEmitter } from '@preevy/common'

export type TransferProgressEvents = {
  bytes: { bytes: number; file: string }
  file: string
}

export type TransferProgressEmitter = SimpleEmitter<TransferProgressEvents>

export const transferProgressEmitter = (): TransferProgressEmitter => simpleEmitter<TransferProgressEvents>()
