import path from 'path'

export const REMOTE_DIR_BASE = '/var/lib/preevy'

export const remoteProjectDir = (projectName: string) => path.join(REMOTE_DIR_BASE, 'projects', projectName)
