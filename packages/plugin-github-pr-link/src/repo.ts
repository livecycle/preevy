export const tryParseRepo = (s: string) => {
  const [owner, repo] = s.split('/')
  return owner && repo ? { owner, repo } : undefined
}

const tryParseUrl = (s: string) => {
  try {
    return new URL(s)
  } catch (e) {
    return undefined
  }
}

export const tryParseUrlToRepo = (s: string) => {
  const url = tryParseUrl(s)
  if (!url) {
    return undefined
  }
  return tryParseRepo(url.pathname.replace(/^\//, '').replace(/\.[^.]*$/, ''))
}
