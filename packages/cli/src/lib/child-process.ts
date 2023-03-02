import childProcess from "child_process";

type Spawn = typeof childProcess['spawn']

export class ProcessError extends Error {
  constructor(message: string, readonly process: childProcess.ChildProcess) {
    super(message)
  }
}

export const spawnPromise = (
  ...args: Parameters<Spawn>
) => new Promise<childProcess.ChildProcess>((resolve, reject) => {
  const process = childProcess.spawn(...args)
  process.on('exit', (code, signal) => {
    if (code !== 0) {
      const message = `process exited with code ${code}${signal ? `and signal ${signal}` : ''}`;
      reject(new ProcessError(message, process))
      return
    }
    resolve(process)
  })
})