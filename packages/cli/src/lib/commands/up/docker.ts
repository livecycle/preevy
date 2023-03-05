import { Logger } from "../../../log";
import { SshClient } from "../../ssh/client";

export type FuncWrapper = <Return>(
  f: () => Promise<Return>,
) => Promise<Return>

export const wrapWithDockerSocket = (
  { sshClient, log, dataDir }: {
    sshClient: SshClient,
    log: Logger,
    dataDir: string,
  },
): FuncWrapper => async <Return>(
  f: () => Promise<Return>,
): Promise<Return> => {
  const { localSocket, close } = await sshClient.forwardOutStreamLocal(
    '/var/run/docker.sock',
    { localDir: dataDir },
  )

  log.debug(`Local socket: ${localSocket}`)

  Object.keys(process.env).filter(k => k.startsWith('DOCKER_')).forEach(k => { delete process.env[k] })

  process.env.DOCKER_HOST = `unix://${localSocket}`

  return f().finally(close)
}


// export const withDockerSocket = async <Return>({ sshClient, log, dataDir }: {
//   sshClient: SshClient,
//   log: Logger,
//   dataDir: string,
// },
//   f: () => Promise<Return>,
// ): Promise<Return> => {
//   const { localSocket, close } = await sshClient.forwardOutStreamLocal(
//     '/var/run/docker.sock',
//     { localDir: dataDir },
//   )

//   log.debug(`Local socket: ${localSocket}`)

//   Object.keys(process.env).filter(k => k.startsWith('DOCKER_')).forEach(k => { delete process.env[k] })

//   process.env.DOCKER_HOST = `unix://${localSocket}`

//   return f().finally(close)
// }

