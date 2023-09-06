import z from 'zod'

export const containerIdSchema = z.object({
  containerId: z.string(),
})

export const execQueryString = z.object({
  cmd: z.array(z.string()).optional().default(['sh']),
  tty: z.coerce.boolean().optional().default(true),
})

export const logsQueryString = z.object({
  stdout: z.coerce.boolean().optional(),
  stderr: z.coerce.boolean().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  timestamps: z.coerce.boolean().optional(),
  tail: z.coerce.number().optional(),
})
