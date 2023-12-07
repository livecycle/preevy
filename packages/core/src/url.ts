export const tryParseUrl = (s: string) => {
  try {
    return new URL(s)
  } catch (e) {
    return undefined
  }
}
