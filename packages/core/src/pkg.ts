import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync } from 'fs'
import { memoize } from 'lodash-es'
import { tmpdir } from 'os'
import path from 'path'

declare let process : NodeJS.Process & {
  pkg?: {}
}

export const isPacked = () => process.pkg !== undefined

export const pkgSnapshotDir = memoize((dir:string) => {
  // can't use fs.cpSync because it's not patched by pkg (https://github.com/vercel/pkg/blob/bb042694e4289a1cbc530d2938babe35ccc84a93/prelude/bootstrap.js#L600)
  const copyDirRecursiveSync = (sourceDir: string, targetDir:string) => {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir)
    }
    const files = readdirSync(sourceDir)
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file)
      const targetPath = path.join(targetDir, file)
      const stat = statSync(sourcePath)
      if (stat.isDirectory()) {
        copyDirRecursiveSync(sourcePath, targetPath)
      } else {
        copyFileSync(sourcePath, targetPath)
      }
    }
  }
  const dest = mkdtempSync(path.join(tmpdir(), path.basename(dir)))
  copyDirRecursiveSync(dir, dest)
  return dest
})
