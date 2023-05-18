import path from 'path'
import { throttle } from 'lodash'
import { ExpandedTransferProgress } from './ssh/client/progress-expanded'
import { FileToCopy, SshClient } from './ssh/client'
import { withSpinner } from './spinner'
import { telemetryEmitter } from './telemetry'

const displayWithUnit = (nbytes: number) => {
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

const SPINNER_PREFIX = 'Copying files:'

const progressText = ({
  bytes, totalBytes, files, totalFiles, currentFile, bytesPerSec,
}: ExpandedTransferProgress) => `${SPINNER_PREFIX}: ${((bytes / totalBytes) * 100).toFixed(2)}% (${files}/${totalFiles}) ${displayWithUnit(bytesPerSec).join('')}/s ${currentFile}`

export const copyFilesWithoutRecreatingDirUsingSftp = async (
  sshClient: SshClient,
  remoteBaseDir: string,
  remoteDir: string,
  filesToCopy: FileToCopy[],
) => {
  const remoteTempDir = (await sshClient.execCommand(`sudo mktemp -d -p "${remoteBaseDir}"`)).stdout.trim()
  await sshClient.execCommand(`sudo chown $USER "${remoteTempDir}"`)
  const filesToCopyToTempDir = filesToCopy.map(
    ({ local, remote }) => ({ local, remote: path.join(remoteTempDir, remote) })
  )

  let numFiles: number
  let numBytes: number

  await withSpinner(async spinner => {
    const startTime = new Date().getTime()
    const sftp = await sshClient.sftp({ concurrency: 4 })
    try {
      const progress = await sftp.putFilesWithExpandedProgress(filesToCopyToTempDir, { chunkSize: 128 * 1024 })
      progress.addListener(throttle((p: ExpandedTransferProgress) => { spinner.text = progressText(p) }, 100))
      progress.addOneTimeListener(state => telemetryEmitter().capture('sftp copy start', { total_bytes: state.totalBytes, files: state.totalFiles }))
      await progress.done
      const doneProgress = await progress.current()
      numFiles = doneProgress.totalFiles
      numBytes = doneProgress.totalBytes
      spinner.text = 'Finishing up...'
    } finally {
      sftp.close()
    }
    await sshClient.execCommand(`sudo rsync -ac --perms "${remoteTempDir}/" "${remoteDir}" && sudo rm -rf "${remoteTempDir}"`)
    telemetryEmitter().capture('sftp copy end', { total_files: numFiles, total_bytes: numBytes, elapsed_sec: (new Date().getTime() - startTime) / 1000 })
  }, { opPrefix: 'Copying files', text: 'Calculating...', successText: () => `Copied ${numFiles} files` })
}
