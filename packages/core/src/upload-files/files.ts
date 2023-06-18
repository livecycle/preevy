import fs from 'fs'

export type FileInfo = { path: string; stats: fs.Stats; symlinkTarget?: string }

export type DirInfo = FileInfo & {
  entries: string[]
}

export type FileToCopy = {
  local: string
  remote: string
}
