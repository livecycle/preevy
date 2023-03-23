import ora from 'ora'

export const withSpinner = async <T>(opts: ora.Options, fn: (spinner: ora.Ora) => Promise<T>) => {
  const spinner = ora(opts)
  spinner.start()
  try {
    const result = await fn(spinner)
    spinner.succeed()
    return result
  } catch (e) {
    spinner.fail()
    throw e
  }
}
