import { StateEmitter, StateEmitterConsumer, stateEmitter } from '@preevy/compose-tunnel-agent'
import { asyncMap, asyncToArray } from 'iter-tools-es'
import { sumArray } from '../../array'
import { FileToCopy, expandFile } from './files'
import { TransferProgressEmitter, transferProgressEmitter } from './progress'
import { TransferOptions } from './transfer'

export type ExpandedTransferProgress = {
  bytes: number
  totalBytes: number
  files: number
  totalFiles: number
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
    all: () => [...store].map(({ value }) => value),
  }
}

const bytesPerSecSampleWindowInSeconds = 5

const expandedTransferProgressEmitter = (
  s: TransferProgressEmitter,
  { totalFiles, totalBytes }: Pick<ExpandedTransferProgress, 'totalFiles' | 'totalBytes'>,
): StateEmitter<ExpandedTransferProgress> => {
  const e = stateEmitter<ExpandedTransferProgress>(
    { bytes: 0, files: 0, totalBytes, totalFiles, currentFile: undefined, bytesPerSec: 0 },
  )
  const lastChunks = ttlStore<number>(bytesPerSecSampleWindowInSeconds * 1000)
  const calcBytesPerSec = () => sumArray(lastChunks.all()) / bytesPerSecSampleWindowInSeconds

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

export const putFilesWithExpandedProgress = (
  putFiles: (files: FileToCopy[], options?: TransferOptions) => Promise<void>,
) => async (
  paths: FileToCopy[],
  options?: TransferOptions,
): Promise<ExpandedProgressConsumer> => {
  const n = await asyncToArray(
    asyncMap(async ({ local, remote }) => ({ local: await expandFile(local), remote }), paths)
  )
  const p = transferProgressEmitter()
  const e = expandedTransferProgressEmitter(p, {
    totalFiles: sumArray(n.map(({ local }) => local.numFiles)),
    totalBytes: sumArray(n.map(({ local }) => local.size)),
  })

  const done = putFiles(paths, { ...options, progress: p })
  return Object.assign(e, { done })
}
