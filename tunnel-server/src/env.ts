export const requiredEnv = (key: string): string => {
  const result = process.env[key]
  if (!result) {
    throw new Error(`required env var ${key} not set`)
  }
  return result
}

export const numberFromEnv = (key: string) => {
  const s = process.env[key]
  if (!s) {
    return undefined
  }
  const result = Number(s)
  if (Number.isNaN(result)) {
    throw new Error(`env var ${key} is not a number: "${s}"`)
  }
  return result
}
