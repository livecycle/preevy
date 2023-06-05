import { SimpleEmitter, simpleEmitter, StateEmitter, StateEmitterConsumer, stateEmitter } from '@preevy/common'
import { map, reduce } from 'iter-tools-es'

export type TransferProgressEvents = {
  bytes: { bytes: number; file: string }
  file: string
}

export type TransferProgressEmitter = SimpleEmitter<TransferProgressEvents>

export const transferProgressEmitter = (): TransferProgressEmitter => simpleEmitter<TransferProgressEvents>()

export type ExpandedTransferProgress = {
  bytes: number
  files: number
  bytesPerSec: number
  currentFile: string | undefined
}

const ttlStore = <T>(ttl: number) => {
  const store = new Set<{ value: T }>()
  return {
    add: (value: T) => {
      const item = { value }
      store.add(item)
      setTimeout(() => { store.delete(item) }, ttl)
    },
    all: () => map(({ value }) => value, store),
  }
}

const bytesPerSecSampleWindowInSeconds = 5

export const expandedTransferProgressEmitter = (
  s: TransferProgressEmitter,
): StateEmitter<ExpandedTransferProgress> => {
  const e = stateEmitter<ExpandedTransferProgress>(
    { bytes: 0, files: 0, currentFile: undefined, bytesPerSec: 0 },
  )
  const lastChunks = ttlStore<number>(bytesPerSecSampleWindowInSeconds * 1000)
  const calcBytesPerSec = () => reduce(0, (res, v) => res + v, lastChunks.all()) / bytesPerSecSampleWindowInSeconds

  s.addListener('bytes', async ({ bytes, file: currentFile }: { bytes: number; file: string }) => {
    lastChunks.add(bytes)
    const bytesPerSec = calcBytesPerSec()
    const current = await e.current()
    const evt = { ...current, bytes: current.bytes + bytes, currentFile, bytesPerSec }
    e.emit(evt)
  })
  s.addListener('file', async (currentFile: string) => {
    const current = await e.current()
    e.emit({ ...current, files: current.files + 1, currentFile })
  })
  return e
}

export type ExpandedProgressConsumer = StateEmitterConsumer<ExpandedTransferProgress> & { done: Promise<void> }
