export const numberFromEnv = (key: string) => {
  const s = process.env[key]
  return s === undefined ? undefined : Number(s)
}

export const requiredEnv = (key: string): string => {
  const result = process.env[key]
  if (!result) {
    throw new Error(`required env var ${key} not set`)
  }
  return result
}
