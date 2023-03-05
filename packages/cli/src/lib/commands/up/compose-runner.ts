import { promisify } from "util";
import childProcess from 'child_process'
import shellEscape from "shell-escape";
import yaml from 'yaml'
import { FuncWrapper } from './docker';
import { ComposeModel } from "../../compose";

const exec = promisify(childProcess.exec);

export const getComposeServiceUrl = (withDockerSocket: FuncWrapper, composeFilePath: string, serviceName: string, servicePort: number) => withDockerSocket(async () => {
  const command = `docker compose -f ${composeFilePath} port ${serviceName} ${servicePort}`
  const { stdout } = await exec(command)
  return stdout.trim()
})

export const getComposeModel = async (withDockerSocket: FuncWrapper, composeFiles: string[]) => {
  const composeFileArgs = composeFiles.flatMap(file => ['-f', file]);

  return withDockerSocket(async () => {
    const command = `docker compose ${shellEscape(composeFileArgs)} convert`
    const { stdout } = await exec(command)
    return yaml.parse(stdout) as ComposeModel
  })
}