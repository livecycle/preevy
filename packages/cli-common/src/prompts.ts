import * as inquirer from '@inquirer/prompts'
import chalk from 'chalk'

const nullPrompt = inquirer.createPrompt<boolean, { message: string; value: string }>(
  (config, done) => {
    const prefix = inquirer.usePrefix()
    done(true)
    return `${prefix} ${chalk.bold(config.message)} ${chalk.cyan(config.value)}`
  },
)

export const selectOrSpecify = async ({ message, choices, specifyItem = '(specify)', specifyItemLocation = 'top' }: {
  message: string
  choices: { name: string; value: string }[]
  specifyItem?: string
  specifyItemLocation?: 'top' | 'bottom'
}) => {
  const specify = () => inquirer.input({ message }, { clearPromptOnDone: true })
  const select = async () => (
    await inquirer.select({
      message,
      choices: specifyItemLocation === 'top' ? [
        { name: specifyItem, value: undefined },
        new inquirer.Separator(),
        ...choices,
      ] : [
        ...choices,
        new inquirer.Separator(),
        { name: specifyItem, value: undefined },
      ],
      loop: false,
    }, { clearPromptOnDone: true })
  ) ?? await specify()
  const result = choices.length ? await select() : await specify()
  await nullPrompt({ message, value: result })
  return result
}
