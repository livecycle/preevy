import { parseSshUrl } from '@preevy/common'
import { PartialConfig, accessSchema } from '../schema/index.js'

export const fromEnv = (
  { env, stderr: { isTTY } }: Pick<NodeJS.Process, 'env'> & { stderr: { isTTY?: boolean } },
): PartialConfig => {
  const json = <T>(key: string) => (env[key] ? JSON.parse(env[key] as string) as T : undefined)
  const bool = (key: string) => ['1', 'true'].includes((env[key] ?? '').toLowerCase())

  return {
    // configFile: env.CONFIG_FILE,
    envId: env.ENV_ID,
    defaultAccess: accessSchema.optional().parse(env.DEFAULT_ACCESS_LEVEL),
    globalInjects: json('GLOBAL_INJECT_SCRIPTS'),
    listen: env.PORT,
    // log: {
    //   level: env.DEBUG ? 'debug' : 'info',
    //   pretty: bool('LOG_PRETTY') || isTTY,
    // },
    machineStatusCommand: json('MACHINE_STATUS_COMMAND'),
    // ssh: {
    //   ...env.SSH_URL ? parseSshUrl(env.SSH_URL) : {},
    //   clientPrivateKey: env.SSH_PRIVATE_KEY,
    //   insecureSkipVerify: bool('INSECURE_SKIP_VERIFY'),
    //   tlsServerName: env.TLS_SERVERNAME,
    // },
  }
}
