export const numberFromEnv = (key: string) => {
  const s = process.env[key]
  return s === undefined ? undefined : Number(s)
}
