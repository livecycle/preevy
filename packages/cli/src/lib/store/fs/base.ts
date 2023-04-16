export type VirtualFS = {
  read: (filename: string) => Promise<Buffer | undefined>
  write: (filename: string, content: Buffer | string) => Promise<void>
  delete: (filename: string) => Promise<void>
}
