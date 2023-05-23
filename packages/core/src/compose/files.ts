import fs from 'fs'

export type ComposeFiles = {
  userSpecifiedFiles: string[]
  systemFiles: string[]
}

const DEFAULT_BASE_FILES = ['compose', 'docker-compose']
const DEFAULT_OVERRIDE_FILES = DEFAULT_BASE_FILES.map(f => `${f}.override`)
const YAML_EXTENSIONS = ['yaml', 'yml']

const oneYamlFile = (baseNames: string[], type: string) => {
  const existingFiles = baseNames
    .flatMap(f => YAML_EXTENSIONS.map(e => `${f}.${e}`))
    .filter(f => fs.existsSync(f))

  if (!existingFiles.length) {
    return undefined
  }

  if (existingFiles.length > 1) {
    throw new Error(`Multiple ${type} files found: ${existingFiles.join(', ')}`)
  }

  return existingFiles[0]
}

const findDefaultFiles = () => {
  const defaultFile = oneYamlFile(DEFAULT_BASE_FILES, 'default Compose')
  if (!defaultFile) {
    return []
  }
  const overrideFile = oneYamlFile(DEFAULT_OVERRIDE_FILES, 'default Compose override')
  return overrideFile ? [defaultFile, overrideFile] : [defaultFile]
}

export const resolveComposeFiles = (
  { userSpecifiedFiles, systemFiles }: ComposeFiles,
): string[] => [...userSpecifiedFiles.length ? userSpecifiedFiles : findDefaultFiles(), ...systemFiles]
