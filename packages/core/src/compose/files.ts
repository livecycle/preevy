import fs from 'fs'
import path from 'path'
import { ComposeFiles } from './model.js'

const DEFAULT_BASE_FILES = ['compose', 'docker-compose']
const DEFAULT_OVERRIDE_FILES = DEFAULT_BASE_FILES.map(f => `${f}.override`)
const DEFAULT_SYSTEM_FILES = DEFAULT_BASE_FILES.map(f => `${f}.preevy`)
const YAML_EXTENSIONS = ['yaml', 'yml']

const fileExists = async (filename: string) => {
  let h: fs.promises.FileHandle
  try {
    h = await fs.promises.open(filename, 'r')
  } catch (e) {
    if ((e as { code: unknown }).code === 'ENOENT') {
      return false
    }
    throw e
  }
  void h?.close()
  return true
}

const filterExistingFiles = async (...filenames: string[]) => (await Promise.all(
  filenames.map(async filename => ({ exists: await fileExists(filename), filename }))
)).filter(({ exists }) => exists).map(({ filename }) => filename)

const oneYamlFileArray = async (baseNames: string[], type: string) => {
  const existingFiles = await filterExistingFiles(
    ...baseNames.flatMap(f => YAML_EXTENSIONS.map(e => `${f}.${e}`))
  )

  if (!existingFiles.length) {
    return undefined
  }

  if (existingFiles.length > 1) {
    throw new Error(`Multiple ${type} files found: ${existingFiles.join(', ')}`)
  }

  return existingFiles
}

const findDefaultFiles = async () => (await oneYamlFileArray(DEFAULT_BASE_FILES, 'default Compose'))
  ?? (await oneYamlFileArray(DEFAULT_OVERRIDE_FILES, 'default Compose override'))
  ?? []

const findDefaultSystemFiles = async () => (await oneYamlFileArray(DEFAULT_SYSTEM_FILES, 'default system Compose')) ?? []

export const resolveComposeFiles = async (
  { userSpecifiedFiles, userSpecifiedSystemFiles, userSpecifiedProjectDirectory, cwd }: {
    userSpecifiedFiles: string[]
    userSpecifiedSystemFiles: string[]
    userSpecifiedProjectDirectory: string
    cwd: string
  },
): Promise<ComposeFiles> => {
  const files = (userSpecifiedFiles.length ? userSpecifiedFiles : await findDefaultFiles())
  const systemFiles = (userSpecifiedSystemFiles.length ? userSpecifiedSystemFiles : await findDefaultSystemFiles())

  return {
    files: [...systemFiles, ...files],
    projectDirectory: path.resolve(userSpecifiedProjectDirectory ?? files.length ? path.dirname(files[0]) : cwd),
  }
}
