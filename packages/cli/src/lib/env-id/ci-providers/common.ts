export const nanToUndefined = (value: number) => (Number.isNaN(value) ? undefined : value)

export const stringOrUndefinedToNumber = (
  value: string | undefined
): number | undefined => (value === undefined ? undefined : nanToUndefined(Number(value)))

const tryParseUrl = (s: string) => {
  try {
    return new URL(s)
  } catch (e) {
    return undefined
  }
}

export const extractPrNumberFromUrlPath = (s: string | undefined) => {
  if (!s) {
    return undefined
  }
  const url = tryParseUrl(s)
  if (!url) {
    return undefined
  }
  return stringOrUndefinedToNumber(url.pathname.match(/\/(\d+)($|\/)/)?.[1])
}
