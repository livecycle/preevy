import zlib from 'zlib'
import { throttle } from 'lodash'
import { withSpinner } from '../spinner'
import { telemetryEmitter } from '../telemetry'
import { filterCommand, filterStore } from './files-filter'
import { FileInfo, FileToCopy } from './files'
import { ExpandedTransferProgress, expandedTransferProgressEmitter } from './progress'
import { FinalizeResult, tarStream } from './tar'
import { CommandExecuter } from '../command-executer'

const displayAndUnit = (nbytes: number) => {
  if (nbytes < 1024) {
    return [nbytes, 'B']
  }
  if (nbytes < 1024 * 1024) {
    return [(nbytes / 1024).toFixed(1), 'KB']
  }
  if (nbytes < 1024 * 1024 * 1024) {
    return [(nbytes / 1024 / 1024).toFixed(1), 'MB']
  }
  return [(nbytes / 1024 / 1024 / 1024).toFixed(1), 'GB']
}

const displayWithUnit = (nbytes: number) => displayAndUnit(nbytes).join('')

const CONCURRENCY = 4

const SPINNER_PREFIX = 'Copying files:'

type Totals = { files: number; bytes: number; skipped: number }

const progressText = (
  { bytes, files, currentFile, bytesPerSec }: ExpandedTransferProgress,
  totals?: Pick<Totals, 'files' | 'bytes'>,
) => {
  const mid = totals
    ? `${((bytes / totals.bytes) * 100).toFixed(2)}% (${files}/${totals.files})`
    : `${displayWithUnit(bytes)} (${files})`

  return [SPINNER_PREFIX, mid, `${displayWithUnit(bytesPerSec)}/s ${currentFile}`].join(' ')
}

const createFilter = async (
  exec: CommandExecuter,
  remoteDir: string,
  totals: Pick<Totals, 'skipped'>,
) => {
  const filterCommandOutput = (await exec(filterCommand, { cwd: remoteDir })).stdout.trim()
  const store = filterStore(filterCommandOutput)
  return (fi: FileInfo, remote: string) => {
    if (store.has(fi, remote)) {
      totals.skipped += 1
      return undefined
    }

    return remote
  }
}

export const upload = async (
  exec: CommandExecuter,
  remoteDir: string,
  filesToCopy: FileToCopy[],
  skipUnchangedFiles = false,
  { onStart } : {
    onStart?: (finalizeResult: Omit<FinalizeResult, 'totals'> & { totals: Promise<Totals> }) => void
  } = {},
) => {
  const tar = tarStream(filesToCopy)
  const gzip = zlib.createGzip()
  const totalSkipped = { skipped: 0 }
  const filter = skipUnchangedFiles ? await createFilter(exec, remoteDir, totalSkipped) : undefined
  const finalizeResult = tar.finalize({ out: gzip, concurrency: CONCURRENCY, filter })
  const execPromise = exec(`tar xz -C "${remoteDir}"`, { stdin: gzip })
  onStart?.({
    ...finalizeResult,
    totals: finalizeResult.totals.then(t => Object.assign(t, totalSkipped)),
  })
  await execPromise
  return totalSkipped
}

export const uploadWithSpinner = async (
  exec: CommandExecuter,
  remoteDir: string,
  filesToCopy: FileToCopy[],
  skipUnchangedFiles = false,
) => {
  await withSpinner(async spinner => {
    const startTime = new Date().getTime()
    let totals: Totals | undefined
    await upload(exec, remoteDir, filesToCopy, skipUnchangedFiles, {
      onStart: ({ emitter, totals: totalsPromise }) => {
        telemetryEmitter().capture('upload start', {})
        const progress = expandedTransferProgressEmitter(emitter)
        void totalsPromise.then(t => { totals = t })
        progress.addListener(throttle((p: ExpandedTransferProgress) => { spinner.text = progressText(p, totals) }, 100))
      },
    })
    telemetryEmitter().capture('upload end', { files: totals?.files, bytes: totals?.bytes, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
    return totals as Totals
  }, {
    opPrefix: 'Copying files',
    text: 'Calculating...',
    successText: ({ files, skipped }) => [
      `Copied ${files} files`,
      skipped && `${`(${skipped} skipped)`}`,
    ].filter(Boolean).join(' '),
  })
}
