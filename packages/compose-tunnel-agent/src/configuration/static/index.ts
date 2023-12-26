import { hideBin } from 'yargs/helpers'
import { merge } from 'lodash-es'
import { fromEnv } from './env.js'
import { fromArgs } from './args.js'
import { fromFile } from './file.js'
import { Config, PartialConfig, configSchema } from '../schema/index.js'

type Process = Pick<NodeJS.Process, 'env' | 'stderr' | 'stdout' | 'argv' | 'exit'>

// export const mergedConfig = async (process: Process): Promise<Config> => {
//   const parsedArgs = await fromArgs(hideBin(process.argv))
//   if ('error' in parsedArgs) {
//     process.stderr.write(parsedArgs.output)
//     process.exit(1)
//   }
//   if ('output' in parsedArgs) {
//     process.stdout.write(parsedArgs.output ?? '')
//     process.exit(0)
//   }
//   const configFromArgs = parsedArgs.result
//   const configFromEnv = fromEnv(process)
//   const configFile = configFromArgs.configFile ?? configFromEnv.configFile
//   const configFromFile = configFile ? await fromFile(configFile) : {}

//   const configs: PartialConfig[] = [configFromFile, configFromEnv, configFromArgs]

//   return configSchema.parse({
//     ...merge({}, ...configs),
//     log: merge({}, ...configs.map(c => c.log)),
//     ssh: merge({}, ...configs.map(c => c.ssh)),
//     providers: configs.flatMap(c => c.providers ?? []),
//     globalInjects: configs.flatMap(c => c.globalInjects ?? []),
//   })
// }
