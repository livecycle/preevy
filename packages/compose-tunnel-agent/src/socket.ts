import { Duplex } from 'stream'

export const ensureClosed = async (socket: Pick<Duplex, 'end' | 'readableEnded' | 'once'>) => {
  if (socket.readableEnded) return
  await new Promise<void>(resolve => {
    socket.once('end', resolve)
    socket.once('error', resolve)
    socket.end()
  })
}
