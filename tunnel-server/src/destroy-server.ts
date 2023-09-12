export type Destroyable = {
  destroy: () => void
  on: (event: 'close', cb: () => void) => void
}

export type DestroyableServer<T extends Destroyable> = {
  on: (event: 'connection', cb: (socket: T) => void) => void
  close: (cb?: (err?: Error) => void) => void
}

export const createDestroy = <T extends Destroyable>(server: DestroyableServer<T>) => {
  const connections = new Set<T>()
  server.on('connection', socket => {
    connections.add(socket)
    socket.on('close', () => { connections.delete(socket) })
  })

  return (cb?: (err?: Error) => void) => {
    server.close(cb)
    connections.forEach(socket => { socket.destroy() })
  }
}
