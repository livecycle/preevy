import ora from 'ora'
import { overrideGetterSetter } from './object'

export type SpinnerOptions = ora.Options & {
  opPrefix?: string
}

export type Spinner = ora.Ora

export const spinner = (opts: SpinnerOptions = {}): Spinner => {
  const fullText = (text?: string) => {
    if (!text) {
      return opts.opPrefix ?? text
    }
    return opts.opPrefix ? `${opts.opPrefix}: ${text}` : text
  }

  const s = ora({ ...opts, text: fullText(opts.text) })

  return overrideGetterSetter(s, 'text', {
    setter: (text, originalSetter) => { originalSetter(fullText(text) ?? '') },
  }, Object.getPrototypeOf(s))
}

export const withSpinner = async <T>(
  fn: (spinner: Spinner) => Promise<T>,
  opts: SpinnerOptions & {
    successText?: (string) | ((result: T) => string) | ((result: T) => Promise<string>)
  } = {},
) => {
  const s = spinner(opts)
  s.start()
  try {
    const result = await fn(s)
    const successText = opts?.successText && (
      typeof opts.successText === 'string'
        ? opts.successText
        : await opts.successText(result)
    )
    s.succeed(successText)
    return result
  } catch (e) {
    s.fail()
    throw e
  }
}
