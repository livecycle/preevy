import path from 'path'
import { SCRIPT_DIR as DIR } from '../static'

export const CUSTOMIZE_BARE_MACHINE = [
  'increase-open-files-limits.sh',
  'install-docker.sh',
  'install-node-exporter-service.sh',
].map(f => path.join(DIR, f))
