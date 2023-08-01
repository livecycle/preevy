import { IncomingMessage, ServerResponse } from 'http'
import Cookies from 'cookies'
import { randomBytes } from 'crypto'
import * as z from 'zod'

// for testing, for production workload use the env var COOKIE_SECRETS
function generateSecret() {
  return randomBytes(32)
    .toString('base64')
    .slice(0, 32)
}

export function session<T>(opts: {domain: string; schema: z.ZodSchema<T>; keys?: string[] }) {
  const keys = opts.keys ?? [generateSecret()]
  return function getSession(req: IncomingMessage, res: ServerResponse<IncomingMessage>, thumbprint: string) {
    const cookies = new Cookies(req, res, {
      secure: true,
      keys,
    })
    const data = cookies.get(`preevy-${thumbprint}`, { signed: true })
    let currentUser = data ? opts.schema.parse(JSON.parse(data)) : undefined

    return {
      get user() { return currentUser },
      set(user: T) {
        currentUser = user
      },
      save: () => {
        cookies.set(`preevy-${thumbprint}`, JSON.stringify(currentUser), { domain: opts.domain, signed: true })
      },
    }
  }
}

export type Session<T> = ReturnType<typeof session<T>>
