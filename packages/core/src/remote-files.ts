import path from 'path'

export const REMOTE_DIR_BASE = '/var/lib/preevy'

export const remoteProjectDir = (projectName: string) => path.posix.join(REMOTE_DIR_BASE, 'projects', projectName)
