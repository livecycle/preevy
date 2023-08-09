export type DockerMachineStatusCommandRecipe = {
  image: string
  network?: string
  entrypoint?: string
  command: readonly string[]
  env?: Record<string, string>
  bindMounts?: string[]
  tty?: boolean
}

export type MachineStatusCommand = {
  recipe: DockerMachineStatusCommandRecipe & { type: 'docker' }
  contentType: string
}
