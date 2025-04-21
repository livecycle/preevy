import { BaseCommand } from '@preevy/cli-common'


export default class Version extends BaseCommand<typeof Version> {
  static description = 'Show Preevy version'

  static enableJsonFlag = true

  async run(): Promise<unknown> {
    const { flags } = this
    const log = this.logger

    if (flags.json) {
      return this.config.version
    }

    log.info(this.config.version)
    return undefined
  }
}
