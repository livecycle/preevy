import { Hook } from '@oclif/core'

const hook: Hook.Init = async () => {
  [process.stdout, process.stderr].forEach(stream => {
    if (stream?.isTTY) {

      (stream as { _handle?: { setBlocking: (blocking: boolean) => void } })._handle?.setBlocking(true)
    }
  })
}

export default hook
