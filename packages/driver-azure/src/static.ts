import path from 'path'
import url from 'url'


const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export const DIR = path.join(__dirname, '../static')
export const SCRIPT_DIR = path.join(DIR, 'scripts')
