export type FsReader = {
  read: (filename: string) => Promise<Buffer | undefined>
}

export type VirtualFS = FsReader & {
  write: (filename: string, content: Buffer | string) => Promise<void>
  delete: (filename: string) => Promise<void>
}
