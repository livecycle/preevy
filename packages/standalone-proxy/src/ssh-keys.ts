import path from 'path'
import fs from 'fs/promises'
import {utils} from "ssh2"

export async function getSSHKeys({
  defaultKeyLocation,
}: {defaultKeyLocation: string}){
    const ssh_host_key_inline = process.env["SSH_HOST_KEY"]
    let privateKeyContents = ""
    if (ssh_host_key_inline) {
      privateKeyContents = Buffer.from(ssh_host_key_inline, 'base64').toString('utf8')
    } else {
      try {
        privateKeyContents = await fs.readFile(path.resolve(".", process.env["SSH_HOST_KEY_PATH"] ?? defaultKeyLocation), {encoding: 'utf8'})
      } catch (e) {
        console.error(e)  
      }
    }
    if (!privateKeyContents) {
      console.error("Error loading SSH host key, use SSH_HOST_KEY_PATH or SSH_HOST_KEY environment variables")
      process.exit(1)
    }
  
    const pkey = utils.parseKey(privateKeyContents)
    if (pkey instanceof Error) {
      console.error("Failed to load SSH host key: " + pkey.message)
      process.exit(1)
    } else {
      return {sshPrivateKey: privateKeyContents, sshPublicKey: pkey.getPublicSSH().toString("utf-8")}
    }
  }