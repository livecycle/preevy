import type { SimpleEmitter } from '@preevy/compose-tunnel-agent'
import { simpleEmitter } from '@preevy/compose-tunnel-agent'

export type TransferProgressEvents = {
  bytes: { bytes: number; file: string }
  file: string
}

export type TransferProgressEmitter = SimpleEmitter<TransferProgressEvents>

export const transferProgressEmitter = (): TransferProgressEmitter => simpleEmitter<TransferProgressEvents>()
