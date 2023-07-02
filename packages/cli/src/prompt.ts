import { ux } from '@oclif/core'

const BOOLEAN_PROMPT_YES = 'yes' as const
const BOOLEAN_PROMPT_NO = 'no' as const

export const BOOLEAN_PROMPT_OPTS = [BOOLEAN_PROMPT_YES, BOOLEAN_PROMPT_NO] as const
type BooleanPromptOpts = typeof BOOLEAN_PROMPT_OPTS[number]

export const carefulBooleanPrompt = async (message: string) => {
  const handleResponse = async (response: string): Promise<boolean> => {
    if (!BOOLEAN_PROMPT_OPTS.includes(response as BooleanPromptOpts)) {
      const newResponse = await ux.prompt(`Please type ${BOOLEAN_PROMPT_OPTS.join(' or ')}`, { required: true })
      return await handleResponse(newResponse)
    }
    return response === BOOLEAN_PROMPT_YES
  }

  const response = await ux.prompt(message, { default: BOOLEAN_PROMPT_NO, required: true })
  return await handleResponse(response)
}
