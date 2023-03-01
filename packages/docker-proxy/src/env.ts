export const requiredEnv = (key: string): string => {
  const result = process.env[key]
  if (!result) {
    throw new Error(`required env var ${key} not set`)
  }
  return result
}