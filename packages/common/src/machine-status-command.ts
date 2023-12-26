import z from 'zod'

export const dockerMachineStatusCommandRecipeSchema = z.object({
  image: z.string(),
  network: z.string().optional(),
  entrypoint: z.string().optional(),
  command: z.array(z.string()),
  env: z.record(z.string()).optional(),
  bindMounts: z.array(z.string()).optional(),
  tty: z.boolean().optional().default(false),
})

export type DockerMachineStatusCommandRecipe = z.infer<typeof dockerMachineStatusCommandRecipeSchema>

export const machineStatusCommandSchema = z.object({
  recipe: dockerMachineStatusCommandRecipeSchema.extend({ type: z.literal('docker') }),
  contentType: z.string(),
})

export type MachineStatusCommand = z.infer<typeof machineStatusCommandSchema>
