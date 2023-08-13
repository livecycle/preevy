export const tryParseJson = (...args: Parameters<typeof JSON.parse>) => {
  try {
    return JSON.parse(...args)
  } catch (e) {
    return undefined
  }
}

export const dateReplacer = (_key: string, value: unknown) => (value instanceof Date ? value.toISOString() : value)
