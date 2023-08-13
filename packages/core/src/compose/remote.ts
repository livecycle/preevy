import yaml from 'yaml'
import { MachineConnection } from '../driver'
import { ComposeModel, composeModelFilename } from './model'
import { REMOTE_DIR_BASE } from '../remote-files'

export const remoteUserModel = async (connection: MachineConnection) => {
  const userModelStr = (await connection.exec(`cat ${REMOTE_DIR_BASE}/projects/*/${composeModelFilename}`)).stdout
  return yaml.parse(userModelStr) as ComposeModel
}
