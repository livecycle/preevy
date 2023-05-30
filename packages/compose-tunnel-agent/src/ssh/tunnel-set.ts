import net from 'net'
import { RunningService } from '../docker'

interface Forward {
  service: RunningService
  host: string
  port: number
  sockets: Set<net.Socket>
  forwardRequestId: string
}

const forwardKey = (forwardRef: string) => forwardRef.replace(/^\/|#.*/g, '')

interface TunnelSet {
  difference: (other: TunnelSet) => TunnelSet
  add: (value: Forward) => void
  delete: (forwardRequestId: string) => void
  get: (forwardRequestId: string) => Forward | undefined
  size: number
  [Symbol.iterator]: () => IterableIterator<Forward>
}

export const tunnelSet = () => {
  const forwards = new Map<string, Forward>()
  return {
    difference: (other: TunnelSet) => {
      const difference = tunnelSet()
      for (const itemKey of forwards.keys()) {
        const otherVal = other.get(itemKey)
        const forwardVal = forwards.get(itemKey)
        if (!otherVal) {
          if (forwardVal) difference.add(forwardVal)
        } else if (forwardVal && forwardVal.forwardRequestId !== otherVal.forwardRequestId) {
          difference.add(forwardVal)
        }
      }
      return difference
    },
    add: (value: Forward) => {
      const { forwardRequestId } = value
      forwards.set(forwardKey(forwardRequestId), { ...value, sockets: new Set() })
    },
    delete: (forwardRequestId: string) => {
      forwards.delete(forwardKey(forwardRequestId))
    },
    size: forwards.size,
    get: (forwardRequestId: string) => forwards.get(forwardKey(forwardRequestId)),
    [Symbol.iterator]: () => forwards.values()[Symbol.iterator](),
  }
}
