type StdoutStream = 'stdout' | 'stderr'
export type ProcessOutputBuffers = { stream: StdoutStream; data: Buffer }[]

export const orderedOutput = (buffers: ProcessOutputBuffers) => {
  const concatOutput = (
    predicate: (s: StdoutStream) => boolean,
  ) => Buffer.concat(buffers.filter(({ stream }) => predicate(stream)).map(({ data }) => data))

  return {
    stdout: () => concatOutput(stream => stream === 'stdout'),
    stderr: () => concatOutput(stream => stream === 'stderr'),
    output: () => concatOutput(() => true),
    toProcess: (
      process: { stdout: NodeJS.WriteStream; stderr: NodeJS.WriteStream },
    ) => buffers.forEach(({ stream, data }) => process[stream].write(data)),
  }
}

export type OrderedOutput = ReturnType<typeof orderedOutput>
