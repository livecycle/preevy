export type VirtualFS = {
    read: (filename: string) => Promise<Buffer | undefined>
    write: (filename: string, content: Buffer | string) => Promise<void>
    delete: (filename: string) => Promise<void>
}

export type Snapshot = {
    write(file: string, content: string | Buffer): Promise<void>
    list(): Promise<string[]>
    delete: (file: string) => Promise<void>
    read(file: string): Promise<undefined | Buffer>
  };

export type Snapshotter = {
    open(s: Buffer | undefined): Promise<{
      snapshot: Snapshot
      close: () => Promise<void>
      save: () => Promise<Buffer>
    }>
  };
