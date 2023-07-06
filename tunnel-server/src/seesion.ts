import { IncomingMessage, ServerResponse } from 'http'
import Cookies from 'cookies'
import * as z from "zod"

export function sessionManager<T>(opts: {domain: string, schema: z.ZodSchema<T>}){
    return function session(req: IncomingMessage, res: ServerResponse<IncomingMessage>, thumbprint: string){
      const cookies =  new Cookies(req, res, {
        secure: true,
      })
      const data = cookies.get(`preevy-${thumbprint}`);
      let currentUser = data ? opts.schema.parse(JSON.parse(data)) : undefined
      return {
        get user(){ return currentUser},
        set(user: T){
          currentUser = user
        },
        save: ()=> {
          cookies.set(`preevy-${thumbprint}`, JSON.stringify(currentUser), {domain: opts.domain})
        }
      }
    }
}

export type SessionManager<T> = ReturnType<typeof sessionManager<T>>