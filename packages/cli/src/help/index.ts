import { Help } from '@oclif/core'
import Flag from './flag'
// import FlagFormatter from './flag'

export default class CustomHelpClass extends Help {
  protected async showRootHelp(): Promise<void> {
    await super.showRootHelp()
    const flag = new Flag(this.config, this.opts)
    this.log(flag.getFlags())
  }
}
