import path from 'path'
import { SCRIPT_DIR as DIR } from '../../static'

export const CUSTOMIZE_BARE_MACHINE = [
  'install-docker.sh',
  'increase-open-files-limits.sh',
].map(f => path.join(DIR, f))
