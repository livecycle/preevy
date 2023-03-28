import path from 'path'
import { debounce } from 'lodash'
import { ExpandedTransferProgress } from './ssh/client/progress-expanded'
import { FileToCopy, SshClient } from './ssh/client'
import { withSpinner } from './spinner'

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
  await sshClient.execCommand(`sudo chown $USER:docker "${remoteTempDir}"`)
  const filesToCopyToTempDir = filesToCopy.map(
    ({ local, remote }) => ({ local, remote: path.join(remoteTempDir, remote) })
  )

  let numFiles: number

  await withSpinner(async spinner => {
    const sftp = await sshClient.sftp({ concurrency: 4 })
    try {
      const progress = await sftp.putFilesWithExpandedProgress(filesToCopyToTempDir, { chunkSize: 128 * 1024 })
      progress.addListener(debounce((p: ExpandedTransferProgress) => { spinner.text = progressText(p) }, 100))
      await progress.done
      numFiles = (await progress.current()).totalFiles
      spinner.text = 'Finishing up...'
    } finally {
      sftp.close()
    }
    await sshClient.execCommand(`rsync -ac --delete "${remoteTempDir}/" "${remoteDir}" && sudo rm -rf "${remoteTempDir}"`)
  }, { opPrefix: 'Copying files', text: 'Calculating...', successText: () => `Copied ${numFiles} files` })
}
