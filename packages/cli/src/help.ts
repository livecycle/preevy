import { Help as HelpBase } from '@oclif/core'
import { text } from '@preevy/cli-common'

export default class Help extends HelpBase {
  override async showRootHelp(): Promise<void> {
    if (!this.opts.stripAnsi) {
      this.log(text.logo)
    }
    return await super.showRootHelp()
  }
}
