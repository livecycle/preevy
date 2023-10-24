import { Help as HelpBase } from '@oclif/core'
import { logo } from '@preevy/cli-common/src/lib/text'

export default class Help extends HelpBase {
  override async showRootHelp(): Promise<void> {
    if (!this.opts.stripAnsi) {
      this.log(logo)
    }
    return await super.showRootHelp()
  }
}
