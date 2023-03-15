import childProcess, { ChildProcess } from 'child_process'
import { promisify } from 'util'

type Spawn = typeof childProcess['spawn']

export class ProcessError extends Error {
  constructor(message: string, readonly process: childProcess.ChildProcess) {
    super(message)
  }
}

export const childProcessPromise = (
  p: ChildProcess
): Promise<ChildProcess> => new Promise<ChildProcess>((resolve, reject) => {
  p.on('exit', (code, signal) => {
    if (code !== 0) {
      const message = `process exited with code ${code}${signal ? `and signal ${signal}` : ''}`
      reject(new ProcessError(message, p))
      return
    }
    resolve(p)
  })
})

export const childProcessStdoutPromise = async (
  p: ChildProcess
): Promise<string> => {
  const out: Buffer[] = []
  p.stdout?.on('data', (data: Buffer) => { out.push(data) })
  await childProcessPromise(p)
  return Buffer.concat(out).toString('utf-8').trim()
}

export const spawnPromise = (
  ...args: Parameters<Spawn>
) => childProcessPromise(childProcess.spawn(...args))

export const execPromise = promisify(childProcess.exec)

export const execPromiseStdout = async (command: string) => (await execPromise(command)).stdout.trim()
