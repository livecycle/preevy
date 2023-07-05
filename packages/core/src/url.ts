export const withBasicAuthCredentials = ({ user, password }:{user: string; password: string}) =>
  (url:string) => Object.assign(new URL(url), {
    username: user,
    password,
  }).toString()
