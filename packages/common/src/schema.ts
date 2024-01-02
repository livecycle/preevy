import z from 'zod'
import { generateErrorMessage } from 'zod-error'

const zodErrorOpts = {
  delimiter: { error: '; ', component: ': ' },
  code: { enabled: false },
  path: { enabled: true, type: 'objectNotation', label: '' },
  message: { enabled: true, label: '' },
} as const

export const generateSchemaErrorMessage = (
  error: z.ZodError
) => generateErrorMessage(error.issues, zodErrorOpts)
